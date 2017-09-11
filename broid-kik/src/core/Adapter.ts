import schemas from '@broid/schemas';
import { Logger } from '@broid/utils';

import * as KikBot from '@kikinteractive/kik';
import * as Promise from 'bluebird';
import { Router  } from 'express';
import * as R from 'ramda';
import { Observable } from 'rxjs/Rx';
import * as url from 'url';
import * as uuid from 'uuid';

import { IAdapterOptions } from './interfaces';
import { Parser } from './Parser';
import { WebHookServer } from './WebHookServer';

export class Adapter {
  private serviceID: string;
  private token: string | null;
  private connected: boolean;
  private session: any;
  private parser: Parser;
  private logLevel: string;
  private username: string;
  private logger: Logger;
  private router: Router;
  private webhookServer: WebHookServer | null;
  private webhookURL: string;
  private storeUsers: Map<string, object>;

  constructor(obj: IAdapterOptions) {
    this.serviceID = obj && obj.serviceID || uuid.v4();
    this.logLevel = obj && obj.logLevel || 'info';
    this.token = obj && obj.token || null;
    this.username = obj && obj.username || 'SMS';
    this.storeUsers = new Map();

    if (this.token === '') {
      throw new Error('Token should exist.');
    }

    this.webhookURL = obj.webhookURL.replace(/\/?$/, '/');

    this.parser = new Parser(this.serviceName(), this.serviceID, this.logLevel);
    this.logger = new Logger('adapter', this.logLevel);
    this.router = Router();
    if (obj.http) {
      this.webhookServer = new WebHookServer(obj.http, this.router, this.logLevel);
    }
  }

  // Return list of users information
  public users(): Promise<Map<string, object>> {
    return Promise.resolve(this.storeUsers);
  }

  // Return list of channels information
  public channels(): Promise<Error> {
    return Promise.reject(new Error('Not supported'));
  }

  // Return the service Name of the current instance
  public serviceName(): string {
    return 'kik';
  }

  // Return the service ID of the current instance
  public serviceId(): string {
    return this.serviceID;
  }

  // Returns the intialized express router
  public getRouter(): Router | null {
    if (this.webhookServer) {
      return null;
    }
    return this.router;
  }

  // Connect to Kik
  // Start the webhook server
  public connect(): Observable<object> {
    if (this.connected) {
      return Observable.of({ type: 'connected', serviceID: this.serviceId() });
    }
    if (!this.token || !this.username || !this.webhookURL) {
      return Observable.throw(new Error('Credentials should exist.'));
    }

    const webhookURL = url.parse(this.webhookURL);
    const kikOptions: any = {
      apiKey: this.token,
      baseUrl: `${webhookURL.protocol}//${webhookURL.hostname}`,
      incomingPath: '/',
      username: this.username,
    };

    if (webhookURL.path) {
      kikOptions.incomingPath = webhookURL.path.replace(/\/?$/, '');
    }

    this.session = new KikBot(kikOptions);
    this.router.use('/', this.session.incoming());

    if (this.webhookServer) {
      this.webhookServer.listen();
    }

    this.connected = true;
    return Observable.of({ type: 'connected', serviceID: this.serviceId() });
  }

  public disconnect(): Promise<null> {
    this.connected = true;
    if (this.webhookServer) {
      return this.webhookServer.close();
    }

    return Promise.resolve(null);
  }

  // Listen 'message' event from Kik
  public listen(): Observable<object> {
    if (!this.session) {
      return Observable.throw(new Error('No session found.'));
    }
    this.session.updateBotConfiguration();

    return Observable.create((observer) => {
      this.session.use((incoming, next) => {
        this.user(incoming.from, true)
          .then((userInformation) =>
            this.parser.normalize(incoming, userInformation))
          .then((normalized) => this.parser.parse(normalized))
          .then((parsed) => this.parser.validate(parsed))
          .then((validated) => {
            if (validated) { observer.next(validated); }
            return next(); // assume all work fine.
          });
      });
    });
  }

  public send(data: object): Promise<object> {
    this.logger.debug('sending', { message: data });

    return schemas(data, 'send')
      .then(() => {
        const toID: string = R.path(['to', 'id'], data) as string ||
          R.path(['to', 'name'], data) as string;
        const dataType: string = R.path(['object', 'type'], data) as string;
        const attachments: any = R.path(['object', 'attachment'], data) as any;

        // Keyboards can be applied to any of the following message types: Image, Video, Note
        let buttons = R.filter(
          (attachment: any) => attachment.type === 'Button',
          attachments || []);
        buttons = R.map((button: any) => button.url || button.name, buttons);
        buttons = R.reject(R.isNil)(buttons);

        return Promise.resolve(buttons)
          .then((btns: any) => {
            if (dataType === 'Image' || dataType === 'Video') {
              const url = R.path(['object', 'url'], data);
              const name = R.path(['object', 'name'], data) || '';
              const preview = R.path(['object', 'preview'], data) || url;

              let message;
              if (dataType === 'Image') {
                message = KikBot.Message.picture(url);
              }
              if (dataType === 'Video') {
                message = KikBot.Message.video(url);
              }

              if (message && name) {
                message.setAttributionName(name);
              }
              if (message && preview) {
                message.setAttributionIcon(preview);
              }

              return [btns, message];
            } else if (dataType === 'Note') {
              return [btns, KikBot.Message.text(R.path(['object', 'content'], data))];
            }

            return [null, null];
          })
          .spread((btns: any, content: any) => {
            if (content) {
              if (btns && !R.isEmpty(btns)) {
                content.addResponseKeyboard(btns, false, toID);
              }

              return this.session.send(content, toID)
                .then(() => ({ type: 'sent', serviceID: this.serviceId() }));
            }

            throw new Error('Only Note, Image, and Video are supported.');
          });
      });
  }

  // Return user information
  private user(key: string, cache: boolean = true): Promise<any> {
    if (!this.session) {
      return Promise.reject(new Error('Session should be initilized before.'));
    }

    if (cache && this.storeUsers.get(key)) {
      const data = this.storeUsers.get(key);
      return Promise.resolve(data);
    }

    return this.session.getUserProfile(key)
      .then((profile) => {
        return {
          displayName: profile.displayName,
          firstName: profile.firstName,
          id: key,
          lastName: profile.lastName,
          profilePicLastModified: profile.profilePicLastModified,
          profilePicUrl: profile.profilePicUrl,
          username: profile.username,
        };
      })
      .then((data) => {
        this.storeUsers.set(key, data);
        return data;
      });
  }
}
