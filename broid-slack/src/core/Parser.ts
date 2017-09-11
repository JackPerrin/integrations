 import {
   default as schemas,
   IActivityStream,
   IASMedia,
 } from '@broid/schemas';
import { cleanNulls, fileInfo, isUrl, Logger } from '@broid/utils';

import * as Promise from 'bluebird';
import * as R from 'ramda';
import * as uuid from 'uuid';

import { IMessage } from './interfaces';

export class Parser {
  public serviceID: string;
  public generatorName: string;
  private logger: Logger;

  constructor(serviceName: string, serviceID: string, logLevel: string) {
    this.serviceID = serviceID;
    this.generatorName = serviceName;
    this.logger = new Logger('parser', logLevel);
  }

  // Validate parsed data with Broid schema validator
  public validate(event: any): Promise<object> {
    this.logger.debug('Validation process', { event });

    const parsed = cleanNulls(event);
    if (!parsed || R.isEmpty(parsed)) { return Promise.resolve(null); }

    if (!parsed.type) {
      this.logger.debug('Type not found.', { parsed });
      return Promise.resolve(null);
    }

    return schemas(parsed, 'activity')
      .then(() => parsed)
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
  }

  // Convert normalized data to Broid schema
  public parse(event: IMessage | null): Promise<object> {
    this.logger.debug('Parse process', { event });

    const normalized = cleanNulls(event);
    if (!normalized || R.isEmpty(normalized)) { return Promise.resolve(null); }
    // Ignore messages with no text field (usually messages from the past);
    if (!normalized.text) { return Promise.resolve(null); }

    const activitystreams = this.createActivityStream(normalized);
    activitystreams.actor = {
      id: R.path(['user', 'id'], normalized),
      name: R.path(['user', 'name'], normalized),
      type: R.path(['user', 'is_bot'], normalized) ? 'Application' : 'Person',
    };

    activitystreams.target = {
      id: R.path(['channel', 'id'], normalized),
      name: R.path(['channel', 'id'], normalized) || R.path(['channel', 'user'], normalized),
      type: R.path(['channel', 'is_im'], normalized) ? 'Person' : 'Group',
    };

    return Promise.resolve(activitystreams)
      .then((as2) => {
        let url: string = normalized.text.substr(1);
        url = url.substring(0, url.length - 1);

        if (isUrl(url)) {
          return fileInfo(url, this.logger)
            .then((infos) => {
              const mediaType: string = infos.mimetype;
              let fileType: string | null = null;

              if (mediaType.startsWith('image/')) {
                fileType = 'Image';
              } else if (mediaType.startsWith('video/')) {
                fileType = 'Video';
              }

              as2.object = {
                id: normalized.eventID || this.createIdentifier(),
                mediaType,
                type: fileType,
                url,
              };

              return as2;
            });
        } else if (normalized.file) {
          const attachment = this.parseFile(normalized.file);
          if (attachment) {
            as2.object = {
              content: attachment.content,
              id: normalized.thread_ts || normalized.ts || this.createIdentifier(),
              mediaType: attachment.mediaType,
              name: attachment.name,
              type: attachment.type,
              url: attachment.url,
            };

            if (attachment.preview) {
              as2.object.preview = attachment.preview;
            }
          }
        }

        return as2;
      })
      .then((as2) => {
        if (!as2.object && !R.isEmpty(normalized.content)) {
          as2.object = {
            content: normalized.text,
            id: normalized.thread_ts || normalized.ts || this.createIdentifier(),
            type: 'Note',
          };
        }

        if (as2.object && normalized.subtype === 'interactive_message') {
          as2.object.context = {
            content: `${normalized.callback_id}#${normalized.response_url}`,
            name: 'interactive_message_callback',
            type: 'Object',
          };
        }

        return as2;
      });
  }

  private createIdentifier(): string {
    return uuid.v4();
  }

  private createActivityStream(normalized: any): IActivityStream {
    const ts: string = normalized.thread_ts || normalized.ts;

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'generator': {
        id: this.serviceID,
        name: this.generatorName,
        type: 'Service',
      },
      'published': ts ? this.ts2Timestamp(ts) : Math.floor(Date.now() / 1000),
      'type': 'Create',
    };
  }

  private ts2Timestamp(ts: string): number {
    const n: number = Number(ts.split('.')[0]);
    return new Date(n * 1000).getTime() / 1000;
  }

  private parseFile(attachment: any): IASMedia | null {
    if (attachment.mimetype.startsWith('image') || attachment.mimetype.startsWith('video')) {
      let mediaType = 'Image';
      if (attachment.mimetype.startsWith('video')) { mediaType = 'Video'; }

      const a: IASMedia = {
        mediaType: attachment.mimetype,
        name: attachment.name,
        type: mediaType,
        url: attachment.permalink_public,
      };

      if (attachment.thumb_1024) {
        a.preview = attachment.thumb_1024;
      }

      if (R.is(Array, attachment.initial_comment)) {
        a.content = attachment.initial_comment[0].comment || '';
      } else {
        a.content = attachment.initial_comment.comment || '';
      }
      return a;
    }
    return null;
  }
}
