[npm]: https://img.shields.io/badge/npm-broid-green.svg?style=flat
[npm-url]: https://www.npmjs.com/org/broid

[node]: https://img.shields.io/node/v/@broid/messenger.svg
[node-url]: https://nodejs.org

[deps]: https://img.shields.io/badge/dependencies-checked-green.svg?style=flat
[deps-url]: #integrations

[tests]: https://img.shields.io/travis/broidHQ/integrations/master.svg
[tests-url]: https://travis-ci.org/broidHQ/integrations

[bithound]: https://img.shields.io/bithound/code/github/broidHQ/integrations.svg
[bithound-url]: https://www.bithound.io/github/broidHQ/integrations

[bithoundscore]: https://www.bithound.io/github/broidHQ/integrations/badges/score.svg
[bithoundscore-url]: https://www.bithound.io/github/broidHQ/integrations

[nsp-checked]: https://img.shields.io/badge/nsp-checked-green.svg?style=flat
[nsp-checked-url]: https://nodesecurity.io

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![bithound][bithound]][bithound-url]
[![bithoundscore][bithoundscore]][bithoundscore-url]
[![nsp-checked][nsp-checked]][nsp-checked-url]

# Broid Messenger Integration

Broid Integrations is an open source project providing a suite of Activity Streams 2 libraries for unified communications among a vast number of communication platforms.

> Connect your App to Multiple Messaging Channels with  One OpenSource Language.

[![gitter](https://badges.gitter.im/broidHQ/broid.svg)](https://t.broid.ai/c/Blwjlw?utm_source=github&utm_medium=readme&utm_campaign=top&link=gitter)
[![slackin](https://slackin.broid.ai/badge.svg)](https://slackin.broid.ai)

## Message types supported

| Simple | Image | Video | Buttons | Location | Phone number |
|:------:|:-----:|:-----:|:-------:|:--------:|:------------:|
|   ✅    |   ✅   |   ✅   |    ✅    |    ✅     |              |

_Phone number is platform limitation._

## Getting started

### Install

```bash
npm install --save @broid/messenger
```

### Connect to Messenger

```javascript
const BroidMessenger = require('@broid/messenger');

const messenger = new broidMessenger({
  token: "<oauth_token>",
  tokenSecret: "<verify_token>",
  http: {
    port: 8080,
    host: "0.0.0.0"
  }
});

messenger.connect()
  .subscribe({
    next: data => console.log(data),
    error: err => console.error(`Something went wrong: ${err.message}`),
    complete: () => console.log('complete'),
  });
```

**Options available**

| name             | Type     | default    | Description  |
| ---------------- |:--------:| :--------: | --------------------------|
| serviceID        | string   | random     | Arbitrary identifier of the running instance |
| logLevel         | string   | `info`     | Can be : `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| token            | string   |            | Your application token |
| tokenSecret      | string   |            | Your auth verify token (hub.verify_token) |
| consumerSecret   | string   |            | You App Secret to validate all requests |
| http             | object   |            | WebServer options (`host`, `port`) |

### Receive a message

```javascript
messenger.listen()
  .subscribe({
    next: data => console.log(`Received message: ${data}`),
    error: err => console.error(`Something went wrong: ${err.message}`),
    complete: () => console.log('complete'),
  });
```

## Buttons supported

| mediaType             | Action types  | Content of value property |
| --------------------- |:-------------:| --------------------------|
| text/html             | web_url       | URL to be opened in the built-in browser. |
| application/vnd.geo+json | location   | Ask for the user location. |
| audio/telephone-event | phone_number  | Destination for a call in following format: "tel:123123123123". |
|                       | postback   | Text of message which client will sent back as ordinary chat message. |



### Not supported yet

|            | Action types   | Content of value property |
| ---------- |:--------------:| --------------------------|
|            | element_share  | Open a share dialog in Messenger. |
|            | payment        |  Opens a checkout dialog to enables purchases. |
|            | account_link   |  Sync the user account. |
|            | account_unlink |  Un sync the user account. |

### Post a message

To send a message, the format should use the [broid-schemas](https://github.com/broidHQ/integrations/tree/master/broid-schemas).

```javascript
const formatted_message = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "generator": {
    "id": "f6e92eb6-f69e-4eae-8158-06613461cf3a",
    "type": "Service",
    "name": "messenger"
  },
  "object": {
    "type": "Note",
    "content": "hello world"
  },
  "to": {
    "type": "Person",
    "id": "1396343657196792"
  }
};

messenger.send(formatted_message)
  .then(() => console.log("ok"))
  .catch(err => console.error(err));
```

## Examples of messages

You can find examples of sent and received messages at [Broid-Schemas](https://github.com/broidHQ/integrations/tree/master/broid-schemas).

## Contributing to Broid

See [CONTRIBUTE.md](../CONTRIBUTE.md)

## Copyright & License

Copyright (c) 2016-2017 Broid.ai

This project is licensed under the AGPL 3, which can be
[found here](https://www.gnu.org/licenses/agpl-3.0.en.html).
