define(['exports'], function (exports) { 'use strict';

/*
* This delay allows the thread to finish assigning its on* methods
* before invoking the delay callback. This is purely a timing hack.
* http://geekabyte.blogspot.com/2014/01/javascript-effect-of-setting-settimeout.html
*
* @param {callback: function} the callback which will be invoked after the timeout
* @parma {context: object} the context in which to invoke the function
*/
function delay(callback, context) {
  setTimeout(function (timeoutContext) { return callback.call(timeoutContext); }, 4, context);
}

function reject(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (!callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

function filter(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

/*
* EventTarget is an interface implemented by objects that can
* receive events and may have listeners for them.
*
* https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
*/
var EventTarget = function EventTarget() {
  this.listeners = {};
};

/*
* Ties a listener function to an event type which can later be invoked via the
* dispatchEvent method.
*
* @param {string} type - the type of event (ie: 'open', 'message', etc.)
* @param {function} listener - the callback function to invoke whenever an event is dispatched matching the given type
* @param {boolean} useCapture - N/A TODO: implement useCapture functionality
*/
EventTarget.prototype.addEventListener = function addEventListener (type, listener /* , useCapture */) {
  if (typeof listener === 'function') {
    if (!Array.isArray(this.listeners[type])) {
      this.listeners[type] = [];
    }

    // Only add the same function once
    if (filter(this.listeners[type], function (item) { return item === listener; }).length === 0) {
      this.listeners[type].push(listener);
    }
  }
};

/*
* Removes the listener so it will no longer be invoked via the dispatchEvent method.
*
* @param {string} type - the type of event (ie: 'open', 'message', etc.)
* @param {function} listener - the callback function to invoke whenever an event is dispatched matching the given type
* @param {boolean} useCapture - N/A TODO: implement useCapture functionality
*/
EventTarget.prototype.removeEventListener = function removeEventListener (type, removingListener /* , useCapture */) {
  var arrayOfListeners = this.listeners[type];
  this.listeners[type] = reject(arrayOfListeners, function (listener) { return listener === removingListener; });
};

/*
* Invokes all listener functions that are listening to the given event.type property. Each
* listener will be passed the event as the first argument.
*
* @param {object} event - event object which will be passed to all listeners of the event.type property
*/
EventTarget.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

  var eventName = event.type;
  var listeners = this.listeners[eventName];

  if (!Array.isArray(listeners)) {
    return false;
  }

  listeners.forEach(function (listener) {
    if (customArguments.length > 0) {
      listener.apply(this$1, customArguments);
    } else {
      listener.call(this$1, event);
    }
  });

  return true;
};

/*
* The network bridge is a way for the mock websocket object to 'communicate' with
* all available servers. This is a singleton object so it is important that you
* clean up urlMap whenever you are finished.
*/
var NetworkBridge = function NetworkBridge() {
  this.urlMap = {};
};

/*
* Attaches a websocket object to the urlMap hash so that it can find the server
* it is connected to and the server in turn can find it.
*
* @param {object} websocket - websocket object to add to the urlMap hash
* @param {string} url
*/
NetworkBridge.prototype.attachWebSocket = function attachWebSocket (websocket, url) {
  var connectionLookup = this.urlMap[url];

  if (connectionLookup &&
      connectionLookup.server &&
      connectionLookup.websockets.indexOf(websocket) === -1) {
    connectionLookup.websockets.push(websocket);
    return connectionLookup.server;
  }
};

/*
* Attaches a websocket to a room
*/
NetworkBridge.prototype.addMembershipToRoom = function addMembershipToRoom (websocket, room) {
  var connectionLookup = this.urlMap[websocket.url];

  if (connectionLookup &&
      connectionLookup.server &&
      connectionLookup.websockets.indexOf(websocket) !== -1) {
    if (!connectionLookup.roomMemberships[room]) {
      connectionLookup.roomMemberships[room] = [];
    }

    connectionLookup.roomMemberships[room].push(websocket);
  }
};

/*
* Attaches a server object to the urlMap hash so that it can find a websockets
* which are connected to it and so that websockets can in turn can find it.
*
* @param {object} server - server object to add to the urlMap hash
* @param {string} url
*/
NetworkBridge.prototype.attachServer = function attachServer (server, url) {
  var connectionLookup = this.urlMap[url];

  if (!connectionLookup) {
    this.urlMap[url] = {
      server: server,
      websockets: [],
      roomMemberships: {}
    };

    return server;
  }
};

/*
* Finds the server which is 'running' on the given url.
*
* @param {string} url - the url to use to find which server is running on it
*/
NetworkBridge.prototype.serverLookup = function serverLookup (url) {
  var connectionLookup = this.urlMap[url];

  if (connectionLookup) {
    return connectionLookup.server;
  }
};

/*
* Finds all websockets which is 'listening' on the given url.
*
* @param {string} url - the url to use to find all websockets which are associated with it
* @param {string} room - if a room is provided, will only return sockets in this room
* @param {class} broadcaster - socket that is broadcasting and is to be excluded from the lookup
*/
NetworkBridge.prototype.websocketsLookup = function websocketsLookup (url, room, broadcaster) {
  var websockets;
  var connectionLookup = this.urlMap[url];

  websockets = connectionLookup ? connectionLookup.websockets : [];

  if (room) {
    var members = connectionLookup.roomMemberships[room];
    websockets = members || [];
  }

  return broadcaster ? websockets.filter(function (websocket) { return websocket !== broadcaster; }) : websockets;
};

/*
* Removes the entry associated with the url.
*
* @param {string} url
*/
NetworkBridge.prototype.removeServer = function removeServer (url) {
  delete this.urlMap[url];
};

/*
* Removes the individual websocket from the map of associated websockets.
*
* @param {object} websocket - websocket object to remove from the url map
* @param {string} url
*/
NetworkBridge.prototype.removeWebSocket = function removeWebSocket (websocket, url) {
  var connectionLookup = this.urlMap[url];

  if (connectionLookup) {
    connectionLookup.websockets = reject(connectionLookup.websockets, function (socket) { return socket === websocket; });
  }
};

/*
* Removes a websocket from a room
*/
NetworkBridge.prototype.removeMembershipFromRoom = function removeMembershipFromRoom (websocket, room) {
  var connectionLookup = this.urlMap[websocket.url];
  var memberships = connectionLookup.roomMemberships[room];

  if (connectionLookup && memberships !== null) {
    connectionLookup.roomMemberships[room] = reject(memberships, function (socket) { return socket === websocket; });
  }
};

var networkBridge = new NetworkBridge(); // Note: this is a singleton

/*
* https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
*/
var codes = {
  CLOSE_NORMAL: 1000,
  CLOSE_GOING_AWAY: 1001,
  CLOSE_PROTOCOL_ERROR: 1002,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_NO_STATUS: 1005,
  CLOSE_ABNORMAL: 1006,
  CLOSE_TOO_LARGE: 1009
};

function normalizeUrl(url) {
  var parts = url.split('://');
  return (parts[1] && parts[1].indexOf('/') === -1) ? (url + "/") : url;
}

function log(method, message) {
  /* eslint-disable no-console */
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console[method].call(null, message);
  }
  /* eslint-enable no-console */
}

var EventPrototype = function EventPrototype () {};

EventPrototype.prototype.stopPropagation = function stopPropagation () {};
EventPrototype.prototype.stopImmediatePropagation = function stopImmediatePropagation () {};

// if no arguments are passed then the type is set to "undefined" on
// chrome and safari.
EventPrototype.prototype.initEvent = function initEvent (type, bubbles, cancelable) {
    if ( type === void 0 ) type = 'undefined';
    if ( bubbles === void 0 ) bubbles = false;
    if ( cancelable === void 0 ) cancelable = false;

  this.type = String(type);
  this.bubbles = Boolean(bubbles);
  this.cancelable = Boolean(cancelable);
};

var Event = (function (EventPrototype$$1) {
  function Event(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError('Failed to construct \'Event\': 1 argument required, but only 0 present.');
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError('Failed to construct \'Event\': parameter 2 (\'eventInitDict\') is not an object');
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;

    this.type = String(type);
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
  }

  if ( EventPrototype$$1 ) Event.__proto__ = EventPrototype$$1;
  Event.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  Event.prototype.constructor = Event;

  return Event;
}(EventPrototype));

var MessageEvent = (function (EventPrototype$$1) {
  function MessageEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError('Failed to construct \'MessageEvent\': 1 argument required, but only 0 present.');
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError('Failed to construct \'MessageEvent\': parameter 2 (\'eventInitDict\') is not an object');
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var data = eventInitConfig.data;
    var origin = eventInitConfig.origin;
    var lastEventId = eventInitConfig.lastEventId;
    var ports = eventInitConfig.ports;

    this.type = String(type);
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.origin = origin ? String(origin) : '';
    this.ports = typeof ports === 'undefined' ? null : ports;
    this.data = typeof data === 'undefined' ? null : data;
    this.lastEventId = lastEventId ? String(lastEventId) : '';
  }

  if ( EventPrototype$$1 ) MessageEvent.__proto__ = EventPrototype$$1;
  MessageEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  MessageEvent.prototype.constructor = MessageEvent;

  return MessageEvent;
}(EventPrototype));

var CloseEvent = (function (EventPrototype$$1) {
  function CloseEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError('Failed to construct \'CloseEvent\': 1 argument required, but only 0 present.');
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError('Failed to construct \'CloseEvent\': parameter 2 (\'eventInitDict\') is not an object');
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var code = eventInitConfig.code;
    var reason = eventInitConfig.reason;
    var wasClean = eventInitConfig.wasClean;

    this.type = String(type);
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.code = typeof code === 'number' ? Number(code) : 0;
    this.reason = reason ? String(reason) : '';
    this.wasClean = wasClean ? Boolean(wasClean) : false;
  }

  if ( EventPrototype$$1 ) CloseEvent.__proto__ = EventPrototype$$1;
  CloseEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  CloseEvent.prototype.constructor = CloseEvent;

  return CloseEvent;
}(EventPrototype));

/*
* Creates an Event object and extends it to allow full modification of
* its properties.
*
* @param {object} config - within config you will need to pass type and optionally target
*/
function createEvent(config) {
  var type = config.type;
  var target = config.target;
  var eventObject = new Event(type);

  if (target) {
    eventObject.target = target;
    eventObject.srcElement = target;
    eventObject.currentTarget = target;
  }

  return eventObject;
}

/*
* Creates a MessageEvent object and extends it to allow full modification of
* its properties.
*
* @param {object} config - within config: type, origin, data and optionally target
*/
function createMessageEvent(config) {
  var type = config.type;
  var origin = config.origin;
  var data = config.data;
  var target = config.target;
  var messageEvent = new MessageEvent(type, {
    data: data,
    origin: origin
  });

  if (target) {
    messageEvent.target = target;
    messageEvent.srcElement = target;
    messageEvent.currentTarget = target;
  }

  return messageEvent;
}

/*
* Creates a CloseEvent object and extends it to allow full modification of
* its properties.
*
* @param {object} config - within config: type and optionally target, code, and reason
*/
function createCloseEvent(config) {
  var code = config.code;
  var reason = config.reason;
  var type = config.type;
  var target = config.target;
  var wasClean = config.wasClean;

  if (!wasClean) {
    wasClean = (code === 1000);
  }

  var closeEvent = new CloseEvent(type, {
    code: code,
    reason: reason,
    wasClean: wasClean
  });

  if (target) {
    closeEvent.target = target;
    closeEvent.srcElement = target;
    closeEvent.currentTarget = target;
  }

  return closeEvent;
}

/*
* The main websocket class which is designed to mimick the native WebSocket class as close
* as possible.
*
* https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
*/
var WebSocket$1 = (function (EventTarget$$1) {
  function WebSocket(url, protocol) {
    if ( protocol === void 0 ) protocol = '';

    EventTarget$$1.call(this);

    if (!url) {
      throw new TypeError('Failed to construct \'WebSocket\': 1 argument required, but only 0 present.');
    }

    this.binaryType = 'blob';
    this.url = normalizeUrl(url);
    this.readyState = WebSocket.CONNECTING;
    this.protocol = '';

    if (typeof protocol === 'string') {
      this.protocol = protocol;
    } else if (Array.isArray(protocol) && protocol.length > 0) {
      this.protocol = protocol[0];
    }

    /*
    * In order to capture the callback function we need to define custom setters.
    * To illustrate:
    *   mySocket.onopen = function() { alert(true) };
    *
    * The only way to capture that function and hold onto it for later is with the
    * below code:
    */
    Object.defineProperties(this, {
      onopen: {
        configurable: true,
        enumerable: true,
        get: function get() { return this.listeners.open; },
        set: function set(listener) {
          this.addEventListener('open', listener);
        }
      },
      onmessage: {
        configurable: true,
        enumerable: true,
        get: function get() { return this.listeners.message; },
        set: function set(listener) {
          this.addEventListener('message', listener);
        }
      },
      onclose: {
        configurable: true,
        enumerable: true,
        get: function get() { return this.listeners.close; },
        set: function set(listener) {
          this.addEventListener('close', listener);
        }
      },
      onerror: {
        configurable: true,
        enumerable: true,
        get: function get() { return this.listeners.error; },
        set: function set(listener) {
          this.addEventListener('error', listener);
        }
      }
    });

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
    * This delay is needed so that we dont trigger an event before the callbacks have been
    * setup. For example:
    *
    * var socket = new WebSocket('ws://localhost');
    *
    * // If we dont have the delay then the event would be triggered right here and this is
    * // before the onopen had a chance to register itself.
    *
    * socket.onopen = () => { // this would never be called };
    *
    * // and with the delay the event gets triggered here after all of the callbacks have been
    * // registered :-)
    */
    delay(function delayCallback() {
      if (server) {
        if (server.options.verifyClient
          && typeof server.options.verifyClient === 'function'
          && !server.options.verifyClient()) {
          this.readyState = WebSocket.CLOSED;

          log(
            'error',
            ("WebSocket connection to '" + (this.url) + "' failed: HTTP Authentication failed; no valid credentials available")
          );

          networkBridge.removeWebSocket(this, this.url);
          this.dispatchEvent(createEvent({ type: 'error', target: this }));
          this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: codes.CLOSE_NORMAL }));
        } else {
          this.readyState = WebSocket.OPEN;
          server.dispatchEvent(createEvent({ type: 'connection' }), server, this);
          this.dispatchEvent(createEvent({ type: 'open', target: this }));
        }
      } else {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: codes.CLOSE_NORMAL }));

        log('error', ("WebSocket connection to '" + (this.url) + "' failed"));
      }
    }, this);
  }

  if ( EventTarget$$1 ) WebSocket.__proto__ = EventTarget$$1;
  WebSocket.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  WebSocket.prototype.constructor = WebSocket;

  /*
  * Transmits data to the server over the WebSocket connection.
  *
  * https://developer.mozilla.org/en-US/docs/Web/API/WebSocket#send()
  */
  WebSocket.prototype.send = function send (data) {
    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      throw new Error('WebSocket is already in CLOSING or CLOSED state');
    }

    var messageEvent = createMessageEvent({
      type: 'message',
      origin: this.url,
      data: data
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      server.dispatchEvent(messageEvent, data);
    }
  };

  /*
  * Closes the WebSocket connection or connection attempt, if any.
  * If the connection is already CLOSED, this method does nothing.
  *
  * https://developer.mozilla.org/en-US/docs/Web/API/WebSocket#close()
  */
  WebSocket.prototype.close = function close () {
    if (this.readyState !== WebSocket.OPEN) { return undefined; }

    var server = networkBridge.serverLookup(this.url);
    var closeEvent = createCloseEvent({
      type: 'close',
      target: this,
      code: codes.CLOSE_NORMAL
    });

    networkBridge.removeWebSocket(this, this.url);

    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(closeEvent);

    if (server) {
      server.dispatchEvent(closeEvent, server);
    }
  };

  return WebSocket;
}(EventTarget));

WebSocket$1.CONNECTING = 0;
WebSocket$1.OPEN = 1;
WebSocket$1.CLOSING = 2;
WebSocket$1.CLOSED = 3;

function retrieveGlobalObject() {
  if (typeof window !== 'undefined') {
    return window;
  }

  return (typeof process === 'object' &&
      typeof require === 'function' &&
      typeof global === 'object') ? global : this;
}

var dedupe = function (arr) {
  return arr.reduce(function(deduped, b){
  	if (deduped.indexOf(b) > -1) { return deduped; }
    return deduped.concat(b);
  }, []);
};

/*
* https://github.com/websockets/ws#server-example
*/
var Server$1 = (function (EventTarget$$1) {
  function Server(url, options) {
    if ( options === void 0 ) options = {};

    EventTarget$$1.call(this);
    this.url = normalizeUrl(url);
    this.originalWebSocket = null;
    var server = networkBridge.attachServer(this, this.url);

    if (!server) {
      this.dispatchEvent(createEvent({ type: 'error' }));
      throw new Error('A mock server is already listening on this url');
    }

    if (typeof options.verifiyClient === 'undefined') {
      options.verifiyClient = null;
    }

    this.options = options;

    this.start();
  }

  if ( EventTarget$$1 ) Server.__proto__ = EventTarget$$1;
  Server.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  Server.prototype.constructor = Server;

  /*
  * Attaches the mock websocket object to the global object
  */
  Server.prototype.start = function start () {
    var globalObj = retrieveGlobalObject();

    if (globalObj.WebSocket) {
      this.originalWebSocket = globalObj.WebSocket;
    }

    globalObj.WebSocket = WebSocket$1;
  };

  /*
  * Removes the mock websocket object from the global object
  */
  Server.prototype.stop = function stop (callback) {
    if ( callback === void 0 ) callback = function () {};

    var globalObj = retrieveGlobalObject();

    if (this.originalWebSocket) {
      globalObj.WebSocket = this.originalWebSocket;
    } else {
      delete globalObj.WebSocket;
    }

    this.originalWebSocket = null;

    networkBridge.removeServer(this.url);

    if (typeof callback === 'function') {
      callback();
    }
  };

  /*
  * This is the main function for the mock server to subscribe to the on events.
  *
  * ie: mockServer.on('connection', function() { console.log('a mock client connected'); });
  *
  * @param {string} type - The event key to subscribe to. Valid keys are: connection, message, and close.
  * @param {function} callback - The callback which should be called when a certain event is fired.
  */
  Server.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
  };

  /*
  * This send function will notify all mock clients via their onmessage callbacks that the server
  * has a message for them.
  *
  * @param {*} data - Any javascript object which will be crafted into a MessageObject.
  */
  Server.prototype.send = function send (data, options) {
    if ( options === void 0 ) options = {};

    this.emit('message', data, options);
  };

  /*
  * Sends a generic message event to all mock clients.
  */
  Server.prototype.emit = function emit (event, data, options) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

    var websockets = options.websockets;

    if (!websockets) {
      websockets = networkBridge.websocketsLookup(this.url);
    }

    if (typeof options !== 'object' || arguments.length > 3) {
      data = Array.prototype.slice.call(arguments, 1, arguments.length);
    }

    websockets.forEach(function (socket) {
      if (Array.isArray(data)) {
        socket.dispatchEvent.apply(socket, [ createMessageEvent({
          type: event,
          data: data,
          origin: this$1.url,
          target: socket
        }) ].concat( data ));
      } else {
        socket.dispatchEvent(createMessageEvent({
          type: event,
          data: data,
          origin: this$1.url,
          target: socket
        }));
      }
    });
  };

  /*
  * Closes the connection and triggers the onclose method of all listening
  * websockets. After that it removes itself from the urlMap so another server
  * could add itself to the url.
  *
  * @param {object} options
  */
  Server.prototype.close = function close (options) {
    if ( options === void 0 ) options = {};

    var code = options.code;
    var reason = options.reason;
    var wasClean = options.wasClean;
    var listeners = networkBridge.websocketsLookup(this.url);

    listeners.forEach(function (socket) {
      socket.readyState = WebSocket$1.CLOSE;
      socket.dispatchEvent(createCloseEvent({
        type: 'close',
        target: socket,
        code: code || codes.CLOSE_NORMAL,
        reason: reason || '',
        wasClean: wasClean
      }));
    });

    this.dispatchEvent(createCloseEvent({ type: 'close' }), this);
    networkBridge.removeServer(this.url);
  };

  /*
  * Returns an array of websockets which are listening to this server
  */
  Server.prototype.clients = function clients () {
    return networkBridge.websocketsLookup(this.url);
  };

  /*
  * Prepares a method to submit an event to members of the room
  *
  * e.g. server.to('my-room').emit('hi!');
  */
  Server.prototype.to = function to (room, broadcaster, broadcastList) {
    var this$1 = this;
    if ( broadcastList === void 0 ) broadcastList = [];

    var self = this;
    var websockets = dedupe(broadcastList.concat(
      networkBridge.websocketsLookup(this.url, room, broadcaster)
    ));

    return {
      to: function (chainedRoom, chainedBroadcaster) { return this$1.to.call(this$1, chainedRoom, chainedBroadcaster, websockets); },
      emit: function emit(event, data) {
        self.emit(event, data, { websockets: websockets });
      }
    };
  };

  /*
   * Alias for Server.to
   */
  Server.prototype.in = function in$1 () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return this.to.apply(null, args);
  };

  return Server;
}(EventTarget));

/*
 * Alternative constructor to support namespaces in socket.io
 *
 * http://socket.io/docs/rooms-and-namespaces/#custom-namespaces
 */
Server$1.of = function of(url) {
  return new Server$1(url);
};

/*
* The socket-io class is designed to mimick the real API as closely as possible.
*
* http://socket.io/docs/
*/
var SocketIO$1 = (function (EventTarget$$1) {
  function SocketIO(url, protocol) {
    var this$1 = this;
    if ( url === void 0 ) url = 'socket.io';
    if ( protocol === void 0 ) protocol = '';

    EventTarget$$1.call(this);

    this.binaryType = 'blob';
    this.url = normalizeUrl(url);
    this.readyState = SocketIO.CONNECTING;
    this.protocol = '';

    if (typeof protocol === 'string') {
      this.protocol = protocol;
    } else if (Array.isArray(protocol) && protocol.length > 0) {
      this.protocol = protocol[0];
    }

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
    * Delay triggering the connection events so they can be defined in time.
    */
    delay(function delayCallback() {
      if (server) {
        this.readyState = SocketIO.OPEN;
        server.dispatchEvent(createEvent({ type: 'connection' }), server, this);
        server.dispatchEvent(createEvent({ type: 'connect' }), server, this); // alias
        this.dispatchEvent(createEvent({ type: 'connect', target: this }));
      } else {
        this.readyState = SocketIO.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(createCloseEvent({
          type: 'close',
          target: this,
          code: codes.CLOSE_NORMAL
        }));

        log('error', ("Socket.io connection to '" + (this.url) + "' failed"));
      }
    }, this);

    /**
      Add an aliased event listener for close / disconnect
     */
    this.addEventListener('close', function (event) {
      this$1.dispatchEvent(createCloseEvent({
        type: 'disconnect',
        target: event.target,
        code: event.code
      }));
    });
  }

  if ( EventTarget$$1 ) SocketIO.__proto__ = EventTarget$$1;
  SocketIO.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  SocketIO.prototype.constructor = SocketIO;

  var prototypeAccessors = { broadcast: {} };

  /*
  * Closes the SocketIO connection or connection attempt, if any.
  * If the connection is already CLOSED, this method does nothing.
  */
  SocketIO.prototype.close = function close () {
    if (this.readyState !== SocketIO.OPEN) { return undefined; }

    var server = networkBridge.serverLookup(this.url);
    networkBridge.removeWebSocket(this, this.url);

    this.readyState = SocketIO.CLOSED;
    this.dispatchEvent(createCloseEvent({
      type: 'close',
      target: this,
      code: codes.CLOSE_NORMAL
    }));

    if (server) {
      server.dispatchEvent(createCloseEvent({
        type: 'disconnect',
        target: this,
        code: codes.CLOSE_NORMAL
      }), server);
    }
  };

  /*
  * Alias for Socket#close
  *
  * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L383
  */
  SocketIO.prototype.disconnect = function disconnect () {
    this.close();
  };

  /*
  * Submits an event to the server with a payload
  */
  SocketIO.prototype.emit = function emit (event) {
    var data = [], len = arguments.length - 1;
    while ( len-- > 0 ) data[ len ] = arguments[ len + 1 ];

    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var messageEvent = createMessageEvent({
      type: event,
      origin: this.url,
      data: data
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      server.dispatchEvent.apply(server, [ messageEvent ].concat( data ));
    }
  };

  /*
  * Submits a 'message' event to the server.
  *
  * Should behave exactly like WebSocket#send
  *
  * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L113
  */
  SocketIO.prototype.send = function send (data) {
    this.emit('message', data);
  };

  /*
  * For broadcasting events to other connected sockets.
  *
  * e.g. socket.broadcast.emit('hi!');
  * e.g. socket.broadcast.to('my-room').emit('hi!');
  */
  prototypeAccessors.broadcast.get = function () {
    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var self = this;
    var server = networkBridge.serverLookup(this.url);
    if (!server) {
      throw new Error(("SocketIO can not find a server at the specified URL (" + (this.url) + ")"));
    }

    return {
      emit: function emit(event, data) {
        server.emit(event, data, { websockets: networkBridge.websocketsLookup(self.url, null, self) });
      },
      to: function to(room) {
        return server.to(room, self);
      },
      in: function in$1(room) {
        return server.in(room, self);
      }
    };
  };

  /*
  * For registering events to be received from the server
  */
  SocketIO.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
  };

  /*
   * Join a room on a server
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.join = function join (room) {
    networkBridge.addMembershipToRoom(this, room);
  };

  /*
   * Get the websocket to leave the room
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.leave = function leave (room) {
    networkBridge.removeMembershipFromRoom(this, room);
  };

  SocketIO.prototype.to = function to (room) {
    return this.broadcast.to(room);
  };

  SocketIO.prototype.in = function in$1 () {
    return this.to.apply(null, args);
  };

  /*
   * Invokes all listener functions that are listening to the given event.type property. Each
   * listener will be passed the event as the first argument.
   *
   * @param {object} event - event object which will be passed to all listeners of the event.type property
   */
  SocketIO.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

    var eventName = event.type;
    var listeners = this.listeners[eventName];

    if (!Array.isArray(listeners)) {
      return false;
    }

    listeners.forEach(function (listener) {
      if (customArguments.length > 0) {
        listener.apply(this$1, customArguments);
      } else {
        // Regular WebSockets expect a MessageEvent but Socketio.io just wants raw data
        //  payload instanceof MessageEvent works, but you can't isntance of NodeEvent
        //  for now we detect if the output has data defined on it
        listener.call(this$1, event.data ? event.data : event);
      }
    });
  };

  Object.defineProperties( SocketIO.prototype, prototypeAccessors );

  return SocketIO;
}(EventTarget));

SocketIO$1.CONNECTING = 0;
SocketIO$1.OPEN = 1;
SocketIO$1.CLOSING = 2;
SocketIO$1.CLOSED = 3;

/*
* Static constructor methods for the IO Socket
*/
var IO = function ioConstructor(url) {
  return new SocketIO$1(url);
};

/*
* Alias the raw IO() constructor
*/
IO.connect = function ioConnect(url) {
  /* eslint-disable new-cap */
  return IO(url);
  /* eslint-enable new-cap */
};

var Server = Server$1;
var WebSocket = WebSocket$1;
var SocketIO = IO;

exports.Server = Server;
exports.WebSocket = WebSocket;
exports.SocketIO = SocketIO;

Object.defineProperty(exports, '__esModule', { value: true });

});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay1zb2NrZXQuYW1kLmpzIiwic291cmNlcyI6WyIuLi9zcmMvaGVscGVycy9kZWxheS5qcyIsIi4uL3NyYy9oZWxwZXJzL2FycmF5LWhlbHBlcnMuanMiLCIuLi9zcmMvZXZlbnQtdGFyZ2V0LmpzIiwiLi4vc3JjL25ldHdvcmstYnJpZGdlLmpzIiwiLi4vc3JjL2hlbHBlcnMvY2xvc2UtY29kZXMuanMiLCIuLi9zcmMvaGVscGVycy9ub3JtYWxpemUtdXJsLmpzIiwiLi4vc3JjL2hlbHBlcnMvbG9nZ2VyLmpzIiwiLi4vc3JjL2hlbHBlcnMvZXZlbnQtcHJvdG90eXBlLmpzIiwiLi4vc3JjL2hlbHBlcnMvZXZlbnQuanMiLCIuLi9zcmMvaGVscGVycy9tZXNzYWdlLWV2ZW50LmpzIiwiLi4vc3JjL2hlbHBlcnMvY2xvc2UtZXZlbnQuanMiLCIuLi9zcmMvZXZlbnQtZmFjdG9yeS5qcyIsIi4uL3NyYy93ZWJzb2NrZXQuanMiLCIuLi9zcmMvaGVscGVycy9nbG9iYWwtb2JqZWN0LmpzIiwiLi4vc3JjL2hlbHBlcnMvZGVkdXBlLmpzIiwiLi4vc3JjL3NlcnZlci5qcyIsIi4uL3NyYy9zb2NrZXQtaW8uanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiogVGhpcyBkZWxheSBhbGxvd3MgdGhlIHRocmVhZCB0byBmaW5pc2ggYXNzaWduaW5nIGl0cyBvbiogbWV0aG9kc1xuKiBiZWZvcmUgaW52b2tpbmcgdGhlIGRlbGF5IGNhbGxiYWNrLiBUaGlzIGlzIHB1cmVseSBhIHRpbWluZyBoYWNrLlxuKiBodHRwOi8vZ2Vla2FieXRlLmJsb2dzcG90LmNvbS8yMDE0LzAxL2phdmFzY3JpcHQtZWZmZWN0LW9mLXNldHRpbmctc2V0dGltZW91dC5odG1sXG4qXG4qIEBwYXJhbSB7Y2FsbGJhY2s6IGZ1bmN0aW9ufSB0aGUgY2FsbGJhY2sgd2hpY2ggd2lsbCBiZSBpbnZva2VkIGFmdGVyIHRoZSB0aW1lb3V0XG4qIEBwYXJtYSB7Y29udGV4dDogb2JqZWN0fSB0aGUgY29udGV4dCBpbiB3aGljaCB0byBpbnZva2UgdGhlIGZ1bmN0aW9uXG4qL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZGVsYXkoY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgc2V0VGltZW91dCh0aW1lb3V0Q29udGV4dCA9PiBjYWxsYmFjay5jYWxsKHRpbWVvdXRDb250ZXh0KSwgNCwgY29udGV4dCk7XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gcmVqZWN0KGFycmF5LCBjYWxsYmFjaykge1xuICBjb25zdCByZXN1bHRzID0gW107XG4gIGFycmF5LmZvckVhY2goKGl0ZW1JbkFycmF5KSA9PiB7XG4gICAgaWYgKCFjYWxsYmFjayhpdGVtSW5BcnJheSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtSW5BcnJheSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlcihhcnJheSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICBhcnJheS5mb3JFYWNoKChpdGVtSW5BcnJheSkgPT4ge1xuICAgIGlmIChjYWxsYmFjayhpdGVtSW5BcnJheSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtSW5BcnJheSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsImltcG9ydCB7IHJlamVjdCwgZmlsdGVyIH0gZnJvbSAnLi9oZWxwZXJzL2FycmF5LWhlbHBlcnMnO1xuXG4vKlxuKiBFdmVudFRhcmdldCBpcyBhbiBpbnRlcmZhY2UgaW1wbGVtZW50ZWQgYnkgb2JqZWN0cyB0aGF0IGNhblxuKiByZWNlaXZlIGV2ZW50cyBhbmQgbWF5IGhhdmUgbGlzdGVuZXJzIGZvciB0aGVtLlxuKlxuKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRXZlbnRUYXJnZXRcbiovXG5jbGFzcyBFdmVudFRhcmdldCB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgfVxuXG4gIC8qXG4gICogVGllcyBhIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFuIGV2ZW50IHR5cGUgd2hpY2ggY2FuIGxhdGVyIGJlIGludm9rZWQgdmlhIHRoZVxuICAqIGRpc3BhdGNoRXZlbnQgbWV0aG9kLlxuICAqXG4gICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSB0aGUgdHlwZSBvZiBldmVudCAoaWU6ICdvcGVuJywgJ21lc3NhZ2UnLCBldGMuKVxuICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZSB3aGVuZXZlciBhbiBldmVudCBpcyBkaXNwYXRjaGVkIG1hdGNoaW5nIHRoZSBnaXZlbiB0eXBlXG4gICogQHBhcmFtIHtib29sZWFufSB1c2VDYXB0dXJlIC0gTi9BIFRPRE86IGltcGxlbWVudCB1c2VDYXB0dXJlIGZ1bmN0aW9uYWxpdHlcbiAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lciAvKiAsIHVzZUNhcHR1cmUgKi8pIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkodGhpcy5saXN0ZW5lcnNbdHlwZV0pKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgYWRkIHRoZSBzYW1lIGZ1bmN0aW9uIG9uY2VcbiAgICAgIGlmIChmaWx0ZXIodGhpcy5saXN0ZW5lcnNbdHlwZV0sIGl0ZW0gPT4gaXRlbSA9PT0gbGlzdGVuZXIpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAqIFJlbW92ZXMgdGhlIGxpc3RlbmVyIHNvIGl0IHdpbGwgbm8gbG9uZ2VyIGJlIGludm9rZWQgdmlhIHRoZSBkaXNwYXRjaEV2ZW50IG1ldGhvZC5cbiAgKlxuICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gdGhlIHR5cGUgb2YgZXZlbnQgKGllOiAnb3BlbicsICdtZXNzYWdlJywgZXRjLilcbiAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIHRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Ugd2hlbmV2ZXIgYW4gZXZlbnQgaXMgZGlzcGF0Y2hlZCBtYXRjaGluZyB0aGUgZ2l2ZW4gdHlwZVxuICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXNlQ2FwdHVyZSAtIE4vQSBUT0RPOiBpbXBsZW1lbnQgdXNlQ2FwdHVyZSBmdW5jdGlvbmFsaXR5XG4gICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgcmVtb3ZpbmdMaXN0ZW5lciAvKiAsIHVzZUNhcHR1cmUgKi8pIHtcbiAgICBjb25zdCBhcnJheU9mTGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV07XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSByZWplY3QoYXJyYXlPZkxpc3RlbmVycywgbGlzdGVuZXIgPT4gbGlzdGVuZXIgPT09IHJlbW92aW5nTGlzdGVuZXIpO1xuICB9XG5cbiAgLypcbiAgKiBJbnZva2VzIGFsbCBsaXN0ZW5lciBmdW5jdGlvbnMgdGhhdCBhcmUgbGlzdGVuaW5nIHRvIHRoZSBnaXZlbiBldmVudC50eXBlIHByb3BlcnR5LiBFYWNoXG4gICogbGlzdGVuZXIgd2lsbCBiZSBwYXNzZWQgdGhlIGV2ZW50IGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgKlxuICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudCAtIGV2ZW50IG9iamVjdCB3aGljaCB3aWxsIGJlIHBhc3NlZCB0byBhbGwgbGlzdGVuZXJzIG9mIHRoZSBldmVudC50eXBlIHByb3BlcnR5XG4gICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnQsIC4uLmN1c3RvbUFyZ3VtZW50cykge1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IGV2ZW50LnR5cGU7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShsaXN0ZW5lcnMpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbGlzdGVuZXJzLmZvckVhY2goKGxpc3RlbmVyKSA9PiB7XG4gICAgICBpZiAoY3VzdG9tQXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgY3VzdG9tQXJndW1lbnRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRUYXJnZXQ7XG4iLCJpbXBvcnQgeyByZWplY3QgfSBmcm9tICcuL2hlbHBlcnMvYXJyYXktaGVscGVycyc7XG5cbi8qXG4qIFRoZSBuZXR3b3JrIGJyaWRnZSBpcyBhIHdheSBmb3IgdGhlIG1vY2sgd2Vic29ja2V0IG9iamVjdCB0byAnY29tbXVuaWNhdGUnIHdpdGhcbiogYWxsIGF2YWlsYWJsZSBzZXJ2ZXJzLiBUaGlzIGlzIGEgc2luZ2xldG9uIG9iamVjdCBzbyBpdCBpcyBpbXBvcnRhbnQgdGhhdCB5b3VcbiogY2xlYW4gdXAgdXJsTWFwIHdoZW5ldmVyIHlvdSBhcmUgZmluaXNoZWQuXG4qL1xuY2xhc3MgTmV0d29ya0JyaWRnZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMudXJsTWFwID0ge307XG4gIH1cblxuICAvKlxuICAqIEF0dGFjaGVzIGEgd2Vic29ja2V0IG9iamVjdCB0byB0aGUgdXJsTWFwIGhhc2ggc28gdGhhdCBpdCBjYW4gZmluZCB0aGUgc2VydmVyXG4gICogaXQgaXMgY29ubmVjdGVkIHRvIGFuZCB0aGUgc2VydmVyIGluIHR1cm4gY2FuIGZpbmQgaXQuXG4gICpcbiAgKiBAcGFyYW0ge29iamVjdH0gd2Vic29ja2V0IC0gd2Vic29ja2V0IG9iamVjdCB0byBhZGQgdG8gdGhlIHVybE1hcCBoYXNoXG4gICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAqL1xuICBhdHRhY2hXZWJTb2NrZXQod2Vic29ja2V0LCB1cmwpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwICYmXG4gICAgICAgIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyICYmXG4gICAgICAgIGNvbm5lY3Rpb25Mb29rdXAud2Vic29ja2V0cy5pbmRleE9mKHdlYnNvY2tldCkgPT09IC0xKSB7XG4gICAgICBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMucHVzaCh3ZWJzb2NrZXQpO1xuICAgICAgcmV0dXJuIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogQXR0YWNoZXMgYSB3ZWJzb2NrZXQgdG8gYSByb29tXG4gICovXG4gIGFkZE1lbWJlcnNoaXBUb1Jvb20od2Vic29ja2V0LCByb29tKSB7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3dlYnNvY2tldC51cmxdO1xuXG4gICAgaWYgKGNvbm5lY3Rpb25Mb29rdXAgJiZcbiAgICAgICAgY29ubmVjdGlvbkxvb2t1cC5zZXJ2ZXIgJiZcbiAgICAgICAgY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLmluZGV4T2Yod2Vic29ja2V0KSAhPT0gLTEpIHtcbiAgICAgIGlmICghY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0pIHtcbiAgICAgICAgY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0gPSBbXTtcbiAgICAgIH1cblxuICAgICAgY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0ucHVzaCh3ZWJzb2NrZXQpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogQXR0YWNoZXMgYSBzZXJ2ZXIgb2JqZWN0IHRvIHRoZSB1cmxNYXAgaGFzaCBzbyB0aGF0IGl0IGNhbiBmaW5kIGEgd2Vic29ja2V0c1xuICAqIHdoaWNoIGFyZSBjb25uZWN0ZWQgdG8gaXQgYW5kIHNvIHRoYXQgd2Vic29ja2V0cyBjYW4gaW4gdHVybiBjYW4gZmluZCBpdC5cbiAgKlxuICAqIEBwYXJhbSB7b2JqZWN0fSBzZXJ2ZXIgLSBzZXJ2ZXIgb2JqZWN0IHRvIGFkZCB0byB0aGUgdXJsTWFwIGhhc2hcbiAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICovXG4gIGF0dGFjaFNlcnZlcihzZXJ2ZXIsIHVybCkge1xuICAgIGNvbnN0IGNvbm5lY3Rpb25Mb29rdXAgPSB0aGlzLnVybE1hcFt1cmxdO1xuXG4gICAgaWYgKCFjb25uZWN0aW9uTG9va3VwKSB7XG4gICAgICB0aGlzLnVybE1hcFt1cmxdID0ge1xuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIHdlYnNvY2tldHM6IFtdLFxuICAgICAgICByb29tTWVtYmVyc2hpcHM6IHt9XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gc2VydmVyO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogRmluZHMgdGhlIHNlcnZlciB3aGljaCBpcyAncnVubmluZycgb24gdGhlIGdpdmVuIHVybC5cbiAgKlxuICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSB0aGUgdXJsIHRvIHVzZSB0byBmaW5kIHdoaWNoIHNlcnZlciBpcyBydW5uaW5nIG9uIGl0XG4gICovXG4gIHNlcnZlckxvb2t1cCh1cmwpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwKSB7XG4gICAgICByZXR1cm4gY29ubmVjdGlvbkxvb2t1cC5zZXJ2ZXI7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgKiBGaW5kcyBhbGwgd2Vic29ja2V0cyB3aGljaCBpcyAnbGlzdGVuaW5nJyBvbiB0aGUgZ2l2ZW4gdXJsLlxuICAqXG4gICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIHRoZSB1cmwgdG8gdXNlIHRvIGZpbmQgYWxsIHdlYnNvY2tldHMgd2hpY2ggYXJlIGFzc29jaWF0ZWQgd2l0aCBpdFxuICAqIEBwYXJhbSB7c3RyaW5nfSByb29tIC0gaWYgYSByb29tIGlzIHByb3ZpZGVkLCB3aWxsIG9ubHkgcmV0dXJuIHNvY2tldHMgaW4gdGhpcyByb29tXG4gICogQHBhcmFtIHtjbGFzc30gYnJvYWRjYXN0ZXIgLSBzb2NrZXQgdGhhdCBpcyBicm9hZGNhc3RpbmcgYW5kIGlzIHRvIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIGxvb2t1cFxuICAqL1xuICB3ZWJzb2NrZXRzTG9va3VwKHVybCwgcm9vbSwgYnJvYWRjYXN0ZXIpIHtcbiAgICBsZXQgd2Vic29ja2V0cztcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIHdlYnNvY2tldHMgPSBjb25uZWN0aW9uTG9va3VwID8gY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzIDogW107XG5cbiAgICBpZiAocm9vbSkge1xuICAgICAgY29uc3QgbWVtYmVycyA9IGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dO1xuICAgICAgd2Vic29ja2V0cyA9IG1lbWJlcnMgfHwgW107XG4gICAgfVxuXG4gICAgcmV0dXJuIGJyb2FkY2FzdGVyID8gd2Vic29ja2V0cy5maWx0ZXIod2Vic29ja2V0ID0+IHdlYnNvY2tldCAhPT0gYnJvYWRjYXN0ZXIpIDogd2Vic29ja2V0cztcbiAgfVxuXG4gIC8qXG4gICogUmVtb3ZlcyB0aGUgZW50cnkgYXNzb2NpYXRlZCB3aXRoIHRoZSB1cmwuXG4gICpcbiAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICovXG4gIHJlbW92ZVNlcnZlcih1cmwpIHtcbiAgICBkZWxldGUgdGhpcy51cmxNYXBbdXJsXTtcbiAgfVxuXG4gIC8qXG4gICogUmVtb3ZlcyB0aGUgaW5kaXZpZHVhbCB3ZWJzb2NrZXQgZnJvbSB0aGUgbWFwIG9mIGFzc29jaWF0ZWQgd2Vic29ja2V0cy5cbiAgKlxuICAqIEBwYXJhbSB7b2JqZWN0fSB3ZWJzb2NrZXQgLSB3ZWJzb2NrZXQgb2JqZWN0IHRvIHJlbW92ZSBmcm9tIHRoZSB1cmwgbWFwXG4gICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAqL1xuICByZW1vdmVXZWJTb2NrZXQod2Vic29ja2V0LCB1cmwpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwKSB7XG4gICAgICBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMgPSByZWplY3QoY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLCBzb2NrZXQgPT4gc29ja2V0ID09PSB3ZWJzb2NrZXQpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogUmVtb3ZlcyBhIHdlYnNvY2tldCBmcm9tIGEgcm9vbVxuICAqL1xuICByZW1vdmVNZW1iZXJzaGlwRnJvbVJvb20od2Vic29ja2V0LCByb29tKSB7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3dlYnNvY2tldC51cmxdO1xuICAgIGNvbnN0IG1lbWJlcnNoaXBzID0gY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCAmJiBtZW1iZXJzaGlwcyAhPT0gbnVsbCkge1xuICAgICAgY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0gPSByZWplY3QobWVtYmVyc2hpcHMsIHNvY2tldCA9PiBzb2NrZXQgPT09IHdlYnNvY2tldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBOZXR3b3JrQnJpZGdlKCk7IC8vIE5vdGU6IHRoaXMgaXMgYSBzaW5nbGV0b25cbiIsIi8qXG4qIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DbG9zZUV2ZW50XG4qL1xuY29uc3QgY29kZXMgPSB7XG4gIENMT1NFX05PUk1BTDogMTAwMCxcbiAgQ0xPU0VfR09JTkdfQVdBWTogMTAwMSxcbiAgQ0xPU0VfUFJPVE9DT0xfRVJST1I6IDEwMDIsXG4gIENMT1NFX1VOU1VQUE9SVEVEOiAxMDAzLFxuICBDTE9TRV9OT19TVEFUVVM6IDEwMDUsXG4gIENMT1NFX0FCTk9STUFMOiAxMDA2LFxuICBDTE9TRV9UT09fTEFSR0U6IDEwMDlcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNvZGVzO1xuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbm9ybWFsaXplVXJsKHVybCkge1xuICBjb25zdCBwYXJ0cyA9IHVybC5zcGxpdCgnOi8vJyk7XG4gIHJldHVybiAocGFydHNbMV0gJiYgcGFydHNbMV0uaW5kZXhPZignLycpID09PSAtMSkgPyBgJHt1cmx9L2AgOiB1cmw7XG59XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBsb2cobWV0aG9kLCBtZXNzYWdlKSB7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Rlc3QnKSB7XG4gICAgY29uc29sZVttZXRob2RdLmNhbGwobnVsbCwgbWVzc2FnZSk7XG4gIH1cbiAgLyogZXNsaW50LWVuYWJsZSBuby1jb25zb2xlICovXG59XG4iLCJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50UHJvdG90eXBlIHtcbiAgLy8gTm9vcHNcbiAgc3RvcFByb3BhZ2F0aW9uKCkge31cbiAgc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCkge31cblxuICAvLyBpZiBubyBhcmd1bWVudHMgYXJlIHBhc3NlZCB0aGVuIHRoZSB0eXBlIGlzIHNldCB0byBcInVuZGVmaW5lZFwiIG9uXG4gIC8vIGNocm9tZSBhbmQgc2FmYXJpLlxuICBpbml0RXZlbnQodHlwZSA9ICd1bmRlZmluZWQnLCBidWJibGVzID0gZmFsc2UsIGNhbmNlbGFibGUgPSBmYWxzZSkge1xuICAgIHRoaXMudHlwZSA9IFN0cmluZyh0eXBlKTtcbiAgICB0aGlzLmJ1YmJsZXMgPSBCb29sZWFuKGJ1YmJsZXMpO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IEJvb2xlYW4oY2FuY2VsYWJsZSk7XG4gIH1cbn1cbiIsImltcG9ydCBFdmVudFByb3RvdHlwZSBmcm9tICcuL2V2ZW50LXByb3RvdHlwZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50IGV4dGVuZHMgRXZlbnRQcm90b3R5cGUge1xuICBjb25zdHJ1Y3Rvcih0eXBlLCBldmVudEluaXRDb25maWcgPSB7fSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZhaWxlZCB0byBjb25zdHJ1Y3QgXFwnRXZlbnRcXCc6IDEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5IDAgcHJlc2VudC4nKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGV2ZW50SW5pdENvbmZpZyAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZhaWxlZCB0byBjb25zdHJ1Y3QgXFwnRXZlbnRcXCc6IHBhcmFtZXRlciAyIChcXCdldmVudEluaXREaWN0XFwnKSBpcyBub3QgYW4gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlIH0gPSBldmVudEluaXRDb25maWc7XG5cbiAgICB0aGlzLnR5cGUgPSBTdHJpbmcodHlwZSk7XG4gICAgdGhpcy50aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLnNyY0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMucmV0dXJuVmFsdWUgPSB0cnVlO1xuICAgIHRoaXMuaXNUcnVzdGVkID0gZmFsc2U7XG4gICAgdGhpcy5ldmVudFBoYXNlID0gMDtcbiAgICB0aGlzLmRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRUYXJnZXQgPSBudWxsO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGUgPyBCb29sZWFuKGNhbmNlbGFibGUpIDogZmFsc2U7XG4gICAgdGhpcy5jYW5uY2VsQnViYmxlID0gZmFsc2U7XG4gICAgdGhpcy5idWJibGVzID0gYnViYmxlcyA/IEJvb2xlYW4oYnViYmxlcykgOiBmYWxzZTtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50UHJvdG90eXBlIGZyb20gJy4vZXZlbnQtcHJvdG90eXBlJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWVzc2FnZUV2ZW50IGV4dGVuZHMgRXZlbnRQcm90b3R5cGUge1xuICBjb25zdHJ1Y3Rvcih0eXBlLCBldmVudEluaXRDb25maWcgPSB7fSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZhaWxlZCB0byBjb25zdHJ1Y3QgXFwnTWVzc2FnZUV2ZW50XFwnOiAxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBldmVudEluaXRDb25maWcgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGYWlsZWQgdG8gY29uc3RydWN0IFxcJ01lc3NhZ2VFdmVudFxcJzogcGFyYW1ldGVyIDIgKFxcJ2V2ZW50SW5pdERpY3RcXCcpIGlzIG5vdCBhbiBvYmplY3QnKTtcbiAgICB9XG5cbiAgICBjb25zdCB7XG4gICAgICBidWJibGVzLFxuICAgICAgY2FuY2VsYWJsZSxcbiAgICAgIGRhdGEsXG4gICAgICBvcmlnaW4sXG4gICAgICBsYXN0RXZlbnRJZCxcbiAgICAgIHBvcnRzXG4gICAgfSA9IGV2ZW50SW5pdENvbmZpZztcblxuICAgIHRoaXMudHlwZSA9IFN0cmluZyh0eXBlKTtcbiAgICB0aGlzLnRpbWVTdGFtcCA9IERhdGUubm93KCk7XG4gICAgdGhpcy50YXJnZXQgPSBudWxsO1xuICAgIHRoaXMuc3JjRWxlbWVudCA9IG51bGw7XG4gICAgdGhpcy5yZXR1cm5WYWx1ZSA9IHRydWU7XG4gICAgdGhpcy5pc1RydXN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmV2ZW50UGhhc2UgPSAwO1xuICAgIHRoaXMuZGVmYXVsdFByZXZlbnRlZCA9IGZhbHNlO1xuICAgIHRoaXMuY3VycmVudFRhcmdldCA9IG51bGw7XG4gICAgdGhpcy5jYW5jZWxhYmxlID0gY2FuY2VsYWJsZSA/IEJvb2xlYW4oY2FuY2VsYWJsZSkgOiBmYWxzZTtcbiAgICB0aGlzLmNhbm5jZWxCdWJibGUgPSBmYWxzZTtcbiAgICB0aGlzLmJ1YmJsZXMgPSBidWJibGVzID8gQm9vbGVhbihidWJibGVzKSA6IGZhbHNlO1xuICAgIHRoaXMub3JpZ2luID0gb3JpZ2luID8gU3RyaW5nKG9yaWdpbikgOiAnJztcbiAgICB0aGlzLnBvcnRzID0gdHlwZW9mIHBvcnRzID09PSAndW5kZWZpbmVkJyA/IG51bGwgOiBwb3J0cztcbiAgICB0aGlzLmRhdGEgPSB0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogZGF0YTtcbiAgICB0aGlzLmxhc3RFdmVudElkID0gbGFzdEV2ZW50SWQgPyBTdHJpbmcobGFzdEV2ZW50SWQpIDogJyc7XG4gIH1cbn1cbiIsImltcG9ydCBFdmVudFByb3RvdHlwZSBmcm9tICcuL2V2ZW50LXByb3RvdHlwZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENsb3NlRXZlbnQgZXh0ZW5kcyBFdmVudFByb3RvdHlwZSB7XG4gIGNvbnN0cnVjdG9yKHR5cGUsIGV2ZW50SW5pdENvbmZpZyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICghdHlwZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmFpbGVkIHRvIGNvbnN0cnVjdCBcXCdDbG9zZUV2ZW50XFwnOiAxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBldmVudEluaXRDb25maWcgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGYWlsZWQgdG8gY29uc3RydWN0IFxcJ0Nsb3NlRXZlbnRcXCc6IHBhcmFtZXRlciAyIChcXCdldmVudEluaXREaWN0XFwnKSBpcyBub3QgYW4gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgY29uc3Qge1xuICAgICAgYnViYmxlcyxcbiAgICAgIGNhbmNlbGFibGUsXG4gICAgICBjb2RlLFxuICAgICAgcmVhc29uLFxuICAgICAgd2FzQ2xlYW5cbiAgICB9ID0gZXZlbnRJbml0Q29uZmlnO1xuXG4gICAgdGhpcy50eXBlID0gU3RyaW5nKHR5cGUpO1xuICAgIHRoaXMudGltZVN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnRhcmdldCA9IG51bGw7XG4gICAgdGhpcy5zcmNFbGVtZW50ID0gbnVsbDtcbiAgICB0aGlzLnJldHVyblZhbHVlID0gdHJ1ZTtcbiAgICB0aGlzLmlzVHJ1c3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuZXZlbnRQaGFzZSA9IDA7XG4gICAgdGhpcy5kZWZhdWx0UHJldmVudGVkID0gZmFsc2U7XG4gICAgdGhpcy5jdXJyZW50VGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLmNhbmNlbGFibGUgPSBjYW5jZWxhYmxlID8gQm9vbGVhbihjYW5jZWxhYmxlKSA6IGZhbHNlO1xuICAgIHRoaXMuY2FubmNlbEJ1YmJsZSA9IGZhbHNlO1xuICAgIHRoaXMuYnViYmxlcyA9IGJ1YmJsZXMgPyBCb29sZWFuKGJ1YmJsZXMpIDogZmFsc2U7XG4gICAgdGhpcy5jb2RlID0gdHlwZW9mIGNvZGUgPT09ICdudW1iZXInID8gTnVtYmVyKGNvZGUpIDogMDtcbiAgICB0aGlzLnJlYXNvbiA9IHJlYXNvbiA/IFN0cmluZyhyZWFzb24pIDogJyc7XG4gICAgdGhpcy53YXNDbGVhbiA9IHdhc0NsZWFuID8gQm9vbGVhbih3YXNDbGVhbikgOiBmYWxzZTtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50IGZyb20gJy4vaGVscGVycy9ldmVudCc7XG5pbXBvcnQgTWVzc2FnZUV2ZW50IGZyb20gJy4vaGVscGVycy9tZXNzYWdlLWV2ZW50JztcbmltcG9ydCBDbG9zZUV2ZW50IGZyb20gJy4vaGVscGVycy9jbG9zZS1ldmVudCc7XG5cbi8qXG4qIENyZWF0ZXMgYW4gRXZlbnQgb2JqZWN0IGFuZCBleHRlbmRzIGl0IHRvIGFsbG93IGZ1bGwgbW9kaWZpY2F0aW9uIG9mXG4qIGl0cyBwcm9wZXJ0aWVzLlxuKlxuKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIC0gd2l0aGluIGNvbmZpZyB5b3Ugd2lsbCBuZWVkIHRvIHBhc3MgdHlwZSBhbmQgb3B0aW9uYWxseSB0YXJnZXRcbiovXG5mdW5jdGlvbiBjcmVhdGVFdmVudChjb25maWcpIHtcbiAgY29uc3QgeyB0eXBlLCB0YXJnZXQgfSA9IGNvbmZpZztcbiAgY29uc3QgZXZlbnRPYmplY3QgPSBuZXcgRXZlbnQodHlwZSk7XG5cbiAgaWYgKHRhcmdldCkge1xuICAgIGV2ZW50T2JqZWN0LnRhcmdldCA9IHRhcmdldDtcbiAgICBldmVudE9iamVjdC5zcmNFbGVtZW50ID0gdGFyZ2V0O1xuICAgIGV2ZW50T2JqZWN0LmN1cnJlbnRUYXJnZXQgPSB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4gZXZlbnRPYmplY3Q7XG59XG5cbi8qXG4qIENyZWF0ZXMgYSBNZXNzYWdlRXZlbnQgb2JqZWN0IGFuZCBleHRlbmRzIGl0IHRvIGFsbG93IGZ1bGwgbW9kaWZpY2F0aW9uIG9mXG4qIGl0cyBwcm9wZXJ0aWVzLlxuKlxuKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIC0gd2l0aGluIGNvbmZpZzogdHlwZSwgb3JpZ2luLCBkYXRhIGFuZCBvcHRpb25hbGx5IHRhcmdldFxuKi9cbmZ1bmN0aW9uIGNyZWF0ZU1lc3NhZ2VFdmVudChjb25maWcpIHtcbiAgY29uc3QgeyB0eXBlLCBvcmlnaW4sIGRhdGEsIHRhcmdldCB9ID0gY29uZmlnO1xuICBjb25zdCBtZXNzYWdlRXZlbnQgPSBuZXcgTWVzc2FnZUV2ZW50KHR5cGUsIHtcbiAgICBkYXRhLFxuICAgIG9yaWdpblxuICB9KTtcblxuICBpZiAodGFyZ2V0KSB7XG4gICAgbWVzc2FnZUV2ZW50LnRhcmdldCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuY3VycmVudFRhcmdldCA9IHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlRXZlbnQ7XG59XG5cbi8qXG4qIENyZWF0ZXMgYSBDbG9zZUV2ZW50IG9iamVjdCBhbmQgZXh0ZW5kcyBpdCB0byBhbGxvdyBmdWxsIG1vZGlmaWNhdGlvbiBvZlxuKiBpdHMgcHJvcGVydGllcy5cbipcbiogQHBhcmFtIHtvYmplY3R9IGNvbmZpZyAtIHdpdGhpbiBjb25maWc6IHR5cGUgYW5kIG9wdGlvbmFsbHkgdGFyZ2V0LCBjb2RlLCBhbmQgcmVhc29uXG4qL1xuZnVuY3Rpb24gY3JlYXRlQ2xvc2VFdmVudChjb25maWcpIHtcbiAgY29uc3QgeyBjb2RlLCByZWFzb24sIHR5cGUsIHRhcmdldCB9ID0gY29uZmlnO1xuICBsZXQgeyB3YXNDbGVhbiB9ID0gY29uZmlnO1xuXG4gIGlmICghd2FzQ2xlYW4pIHtcbiAgICB3YXNDbGVhbiA9IChjb2RlID09PSAxMDAwKTtcbiAgfVxuXG4gIGNvbnN0IGNsb3NlRXZlbnQgPSBuZXcgQ2xvc2VFdmVudCh0eXBlLCB7XG4gICAgY29kZSxcbiAgICByZWFzb24sXG4gICAgd2FzQ2xlYW5cbiAgfSk7XG5cbiAgaWYgKHRhcmdldCkge1xuICAgIGNsb3NlRXZlbnQudGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGNsb3NlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBjbG9zZUV2ZW50LmN1cnJlbnRUYXJnZXQgPSB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4gY2xvc2VFdmVudDtcbn1cblxuZXhwb3J0IHtcbiAgY3JlYXRlRXZlbnQsXG4gIGNyZWF0ZU1lc3NhZ2VFdmVudCxcbiAgY3JlYXRlQ2xvc2VFdmVudFxufTtcbiIsImltcG9ydCBkZWxheSBmcm9tICcuL2hlbHBlcnMvZGVsYXknO1xuaW1wb3J0IEV2ZW50VGFyZ2V0IGZyb20gJy4vZXZlbnQtdGFyZ2V0JztcbmltcG9ydCBuZXR3b3JrQnJpZGdlIGZyb20gJy4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IENMT1NFX0NPREVTIGZyb20gJy4vaGVscGVycy9jbG9zZS1jb2Rlcyc7XG5pbXBvcnQgbm9ybWFsaXplIGZyb20gJy4vaGVscGVycy9ub3JtYWxpemUtdXJsJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi9oZWxwZXJzL2xvZ2dlcic7XG5pbXBvcnQgeyBjcmVhdGVFdmVudCwgY3JlYXRlTWVzc2FnZUV2ZW50LCBjcmVhdGVDbG9zZUV2ZW50IH0gZnJvbSAnLi9ldmVudC1mYWN0b3J5JztcblxuLypcbiogVGhlIG1haW4gd2Vic29ja2V0IGNsYXNzIHdoaWNoIGlzIGRlc2lnbmVkIHRvIG1pbWljayB0aGUgbmF0aXZlIFdlYlNvY2tldCBjbGFzcyBhcyBjbG9zZVxuKiBhcyBwb3NzaWJsZS5cbipcbiogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYlNvY2tldFxuKi9cbmNsYXNzIFdlYlNvY2tldCBleHRlbmRzIEV2ZW50VGFyZ2V0IHtcbiAgLypcbiAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICovXG4gIGNvbnN0cnVjdG9yKHVybCwgcHJvdG9jb2wgPSAnJykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAoIXVybCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmFpbGVkIHRvIGNvbnN0cnVjdCBcXCdXZWJTb2NrZXRcXCc6IDEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5IDAgcHJlc2VudC4nKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmFyeVR5cGUgPSAnYmxvYic7XG4gICAgdGhpcy51cmwgPSBub3JtYWxpemUodXJsKTtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ09OTkVDVElORztcbiAgICB0aGlzLnByb3RvY29sID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHByb3RvY29sID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm90b2NvbCkgJiYgcHJvdG9jb2wubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sWzBdO1xuICAgIH1cblxuICAgIC8qXG4gICAgKiBJbiBvcmRlciB0byBjYXB0dXJlIHRoZSBjYWxsYmFjayBmdW5jdGlvbiB3ZSBuZWVkIHRvIGRlZmluZSBjdXN0b20gc2V0dGVycy5cbiAgICAqIFRvIGlsbHVzdHJhdGU6XG4gICAgKiAgIG15U29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKCkgeyBhbGVydCh0cnVlKSB9O1xuICAgICpcbiAgICAqIFRoZSBvbmx5IHdheSB0byBjYXB0dXJlIHRoYXQgZnVuY3Rpb24gYW5kIGhvbGQgb250byBpdCBmb3IgbGF0ZXIgaXMgd2l0aCB0aGVcbiAgICAqIGJlbG93IGNvZGU6XG4gICAgKi9cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICBvbm9wZW46IHtcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQoKSB7IHJldHVybiB0aGlzLmxpc3RlbmVycy5vcGVuOyB9LFxuICAgICAgICBzZXQobGlzdGVuZXIpIHtcbiAgICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvbm1lc3NhZ2U6IHtcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQoKSB7IHJldHVybiB0aGlzLmxpc3RlbmVycy5tZXNzYWdlOyB9LFxuICAgICAgICBzZXQobGlzdGVuZXIpIHtcbiAgICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvbmNsb3NlOiB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgZ2V0KCkgeyByZXR1cm4gdGhpcy5saXN0ZW5lcnMuY2xvc2U7IH0sXG4gICAgICAgIHNldChsaXN0ZW5lcikge1xuICAgICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvbmVycm9yOiB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgZ2V0KCkgeyByZXR1cm4gdGhpcy5saXN0ZW5lcnMuZXJyb3I7IH0sXG4gICAgICAgIHNldChsaXN0ZW5lcikge1xuICAgICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgKiBUaGlzIGRlbGF5IGlzIG5lZWRlZCBzbyB0aGF0IHdlIGRvbnQgdHJpZ2dlciBhbiBldmVudCBiZWZvcmUgdGhlIGNhbGxiYWNrcyBoYXZlIGJlZW5cbiAgICAqIHNldHVwLiBGb3IgZXhhbXBsZTpcbiAgICAqXG4gICAgKiB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldCgnd3M6Ly9sb2NhbGhvc3QnKTtcbiAgICAqXG4gICAgKiAvLyBJZiB3ZSBkb250IGhhdmUgdGhlIGRlbGF5IHRoZW4gdGhlIGV2ZW50IHdvdWxkIGJlIHRyaWdnZXJlZCByaWdodCBoZXJlIGFuZCB0aGlzIGlzXG4gICAgKiAvLyBiZWZvcmUgdGhlIG9ub3BlbiBoYWQgYSBjaGFuY2UgdG8gcmVnaXN0ZXIgaXRzZWxmLlxuICAgICpcbiAgICAqIHNvY2tldC5vbm9wZW4gPSAoKSA9PiB7IC8vIHRoaXMgd291bGQgbmV2ZXIgYmUgY2FsbGVkIH07XG4gICAgKlxuICAgICogLy8gYW5kIHdpdGggdGhlIGRlbGF5IHRoZSBldmVudCBnZXRzIHRyaWdnZXJlZCBoZXJlIGFmdGVyIGFsbCBvZiB0aGUgY2FsbGJhY2tzIGhhdmUgYmVlblxuICAgICogLy8gcmVnaXN0ZXJlZCA6LSlcbiAgICAqL1xuICAgIGRlbGF5KGZ1bmN0aW9uIGRlbGF5Q2FsbGJhY2soKSB7XG4gICAgICBpZiAoc2VydmVyKSB7XG4gICAgICAgIGlmIChzZXJ2ZXIub3B0aW9ucy52ZXJpZnlDbGllbnRcbiAgICAgICAgICAmJiB0eXBlb2Ygc2VydmVyLm9wdGlvbnMudmVyaWZ5Q2xpZW50ID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgJiYgIXNlcnZlci5vcHRpb25zLnZlcmlmeUNsaWVudCgpKSB7XG4gICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NFRDtcblxuICAgICAgICAgIGxvZ2dlcihcbiAgICAgICAgICAgICdlcnJvcicsXG4gICAgICAgICAgICBgV2ViU29ja2V0IGNvbm5lY3Rpb24gdG8gJyR7dGhpcy51cmx9JyBmYWlsZWQ6IEhUVFAgQXV0aGVudGljYXRpb24gZmFpbGVkOyBubyB2YWxpZCBjcmVkZW50aWFscyBhdmFpbGFibGVgXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcbiAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVDbG9zZUV2ZW50KHsgdHlwZTogJ2Nsb3NlJywgdGFyZ2V0OiB0aGlzLCBjb2RlOiBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwgfSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5PUEVOO1xuICAgICAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3Rpb24nIH0pLCBzZXJ2ZXIsIHRoaXMpO1xuICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdvcGVuJywgdGFyZ2V0OiB0aGlzIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NFRDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Vycm9yJywgdGFyZ2V0OiB0aGlzIH0pKTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoeyB0eXBlOiAnY2xvc2UnLCB0YXJnZXQ6IHRoaXMsIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTCB9KSk7XG5cbiAgICAgICAgbG9nZ2VyKCdlcnJvcicsIGBXZWJTb2NrZXQgY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZGApO1xuICAgICAgfVxuICAgIH0sIHRoaXMpO1xuICB9XG5cbiAgLypcbiAgKiBUcmFuc21pdHMgZGF0YSB0byB0aGUgc2VydmVyIG92ZXIgdGhlIFdlYlNvY2tldCBjb25uZWN0aW9uLlxuICAqXG4gICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYlNvY2tldCNzZW5kKClcbiAgKi9cbiAgc2VuZChkYXRhKSB7XG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0LkNMT1NJTkcgfHwgdGhpcy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ0xPU0VEKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYlNvY2tldCBpcyBhbHJlYWR5IGluIENMT1NJTkcgb3IgQ0xPU0VEIHN0YXRlJyk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZUV2ZW50ID0gY3JlYXRlTWVzc2FnZUV2ZW50KHtcbiAgICAgIHR5cGU6ICdtZXNzYWdlJyxcbiAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICBkYXRhXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXR3b3JrQnJpZGdlLnNlcnZlckxvb2t1cCh0aGlzLnVybCk7XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChtZXNzYWdlRXZlbnQsIGRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogQ2xvc2VzIHRoZSBXZWJTb2NrZXQgY29ubmVjdGlvbiBvciBjb25uZWN0aW9uIGF0dGVtcHQsIGlmIGFueS5cbiAgKiBJZiB0aGUgY29ubmVjdGlvbiBpcyBhbHJlYWR5IENMT1NFRCwgdGhpcyBtZXRob2QgZG9lcyBub3RoaW5nLlxuICAqXG4gICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYlNvY2tldCNjbG9zZSgpXG4gICovXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5PUEVOKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKHRoaXMudXJsKTtcbiAgICBjb25zdCBjbG9zZUV2ZW50ID0gY3JlYXRlQ2xvc2VFdmVudCh7XG4gICAgICB0eXBlOiAnY2xvc2UnLFxuICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMXG4gICAgfSk7XG5cbiAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldCh0aGlzLCB0aGlzLnVybCk7XG5cbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjbG9zZUV2ZW50KTtcblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNsb3NlRXZlbnQsIHNlcnZlcik7XG4gICAgfVxuICB9XG59XG5cbldlYlNvY2tldC5DT05ORUNUSU5HID0gMDtcbldlYlNvY2tldC5PUEVOID0gMTtcbldlYlNvY2tldC5DTE9TSU5HID0gMjtcbldlYlNvY2tldC5DTE9TRUQgPSAzO1xuXG5leHBvcnQgZGVmYXVsdCBXZWJTb2NrZXQ7XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZXRyaWV2ZUdsb2JhbE9iamVjdCgpIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIHdpbmRvdztcbiAgfVxuXG4gIHJldHVybiAodHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgdHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcpID8gZ2xvYmFsIDogdGhpcztcbn1cbiIsImV4cG9ydCBkZWZhdWx0IChhcnIpID0+IHtcbiAgcmV0dXJuIGFyci5yZWR1Y2UoZnVuY3Rpb24oZGVkdXBlZCwgYil7XG4gIFx0aWYgKGRlZHVwZWQuaW5kZXhPZihiKSA+IC0xKSByZXR1cm4gZGVkdXBlZDtcbiAgICByZXR1cm4gZGVkdXBlZC5jb25jYXQoYik7XG4gIH0sIFtdKTtcbn1cbiIsImltcG9ydCBXZWJTb2NrZXQgZnJvbSAnLi93ZWJzb2NrZXQnO1xuaW1wb3J0IEV2ZW50VGFyZ2V0IGZyb20gJy4vZXZlbnQtdGFyZ2V0JztcbmltcG9ydCBuZXR3b3JrQnJpZGdlIGZyb20gJy4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IENMT1NFX0NPREVTIGZyb20gJy4vaGVscGVycy9jbG9zZS1jb2Rlcyc7XG5pbXBvcnQgbm9ybWFsaXplIGZyb20gJy4vaGVscGVycy9ub3JtYWxpemUtdXJsJztcbmltcG9ydCBnbG9iYWxPYmplY3QgZnJvbSAnLi9oZWxwZXJzL2dsb2JhbC1vYmplY3QnO1xuaW1wb3J0IGRlZHVwZSBmcm9tICcuL2hlbHBlcnMvZGVkdXBlJztcbmltcG9ydCB7IGNyZWF0ZUV2ZW50LCBjcmVhdGVNZXNzYWdlRXZlbnQsIGNyZWF0ZUNsb3NlRXZlbnQgfSBmcm9tICcuL2V2ZW50LWZhY3RvcnknO1xuXG4vKlxuKiBodHRwczovL2dpdGh1Yi5jb20vd2Vic29ja2V0cy93cyNzZXJ2ZXItZXhhbXBsZVxuKi9cbmNsYXNzIFNlcnZlciBleHRlbmRzIEV2ZW50VGFyZ2V0IHtcbiAgLypcbiAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICovXG4gIGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnVybCA9IG5vcm1hbGl6ZSh1cmwpO1xuICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBudWxsO1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoU2VydmVyKHRoaXMsIHRoaXMudXJsKTtcblxuICAgIGlmICghc2VydmVyKSB7XG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InIH0pKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQSBtb2NrIHNlcnZlciBpcyBhbHJlYWR5IGxpc3RlbmluZyBvbiB0aGlzIHVybCcpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy52ZXJpZml5Q2xpZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgb3B0aW9ucy52ZXJpZml5Q2xpZW50ID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgdGhpcy5zdGFydCgpO1xuICB9XG5cbiAgLypcbiAgKiBBdHRhY2hlcyB0aGUgbW9jayB3ZWJzb2NrZXQgb2JqZWN0IHRvIHRoZSBnbG9iYWwgb2JqZWN0XG4gICovXG4gIHN0YXJ0KCkge1xuICAgIGNvbnN0IGdsb2JhbE9iaiA9IGdsb2JhbE9iamVjdCgpO1xuXG4gICAgaWYgKGdsb2JhbE9iai5XZWJTb2NrZXQpIHtcbiAgICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBnbG9iYWxPYmouV2ViU29ja2V0O1xuICAgIH1cblxuICAgIGdsb2JhbE9iai5XZWJTb2NrZXQgPSBXZWJTb2NrZXQ7XG4gIH1cblxuICAvKlxuICAqIFJlbW92ZXMgdGhlIG1vY2sgd2Vic29ja2V0IG9iamVjdCBmcm9tIHRoZSBnbG9iYWwgb2JqZWN0XG4gICovXG4gIHN0b3AoY2FsbGJhY2sgPSAoKSA9PiB7fSkge1xuICAgIGNvbnN0IGdsb2JhbE9iaiA9IGdsb2JhbE9iamVjdCgpO1xuXG4gICAgaWYgKHRoaXMub3JpZ2luYWxXZWJTb2NrZXQpIHtcbiAgICAgIGdsb2JhbE9iai5XZWJTb2NrZXQgPSB0aGlzLm9yaWdpbmFsV2ViU29ja2V0O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZ2xvYmFsT2JqLldlYlNvY2tldDtcbiAgICB9XG5cbiAgICB0aGlzLm9yaWdpbmFsV2ViU29ja2V0ID0gbnVsbDtcblxuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlU2VydmVyKHRoaXMudXJsKTtcblxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgKiBUaGlzIGlzIHRoZSBtYWluIGZ1bmN0aW9uIGZvciB0aGUgbW9jayBzZXJ2ZXIgdG8gc3Vic2NyaWJlIHRvIHRoZSBvbiBldmVudHMuXG4gICpcbiAgKiBpZTogbW9ja1NlcnZlci5vbignY29ubmVjdGlvbicsIGZ1bmN0aW9uKCkgeyBjb25zb2xlLmxvZygnYSBtb2NrIGNsaWVudCBjb25uZWN0ZWQnKTsgfSk7XG4gICpcbiAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBldmVudCBrZXkgdG8gc3Vic2NyaWJlIHRvLiBWYWxpZCBrZXlzIGFyZTogY29ubmVjdGlvbiwgbWVzc2FnZSwgYW5kIGNsb3NlLlxuICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHdoaWNoIHNob3VsZCBiZSBjYWxsZWQgd2hlbiBhIGNlcnRhaW4gZXZlbnQgaXMgZmlyZWQuXG4gICovXG4gIG9uKHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qXG4gICogVGhpcyBzZW5kIGZ1bmN0aW9uIHdpbGwgbm90aWZ5IGFsbCBtb2NrIGNsaWVudHMgdmlhIHRoZWlyIG9ubWVzc2FnZSBjYWxsYmFja3MgdGhhdCB0aGUgc2VydmVyXG4gICogaGFzIGEgbWVzc2FnZSBmb3IgdGhlbS5cbiAgKlxuICAqIEBwYXJhbSB7Kn0gZGF0YSAtIEFueSBqYXZhc2NyaXB0IG9iamVjdCB3aGljaCB3aWxsIGJlIGNyYWZ0ZWQgaW50byBhIE1lc3NhZ2VPYmplY3QuXG4gICovXG4gIHNlbmQoZGF0YSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSwgb3B0aW9ucyk7XG4gIH1cblxuICAvKlxuICAqIFNlbmRzIGEgZ2VuZXJpYyBtZXNzYWdlIGV2ZW50IHRvIGFsbCBtb2NrIGNsaWVudHMuXG4gICovXG4gIGVtaXQoZXZlbnQsIGRhdGEsIG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCB7IHdlYnNvY2tldHMgfSA9IG9wdGlvbnM7XG5cbiAgICBpZiAoIXdlYnNvY2tldHMpIHtcbiAgICAgIHdlYnNvY2tldHMgPSBuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgYXJndW1lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgIGRhdGEgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEsIGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIH1cblxuICAgIHdlYnNvY2tldHMuZm9yRWFjaCgoc29ja2V0KSA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICBzb2NrZXQuZGlzcGF0Y2hFdmVudChjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgIHR5cGU6IGV2ZW50LFxuICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgb3JpZ2luOiB0aGlzLnVybCxcbiAgICAgICAgICB0YXJnZXQ6IHNvY2tldFxuICAgICAgICB9KSwgLi4uZGF0YSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb2NrZXQuZGlzcGF0Y2hFdmVudChjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgIHR5cGU6IGV2ZW50LFxuICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgb3JpZ2luOiB0aGlzLnVybCxcbiAgICAgICAgICB0YXJnZXQ6IHNvY2tldFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiBhbmQgdHJpZ2dlcnMgdGhlIG9uY2xvc2UgbWV0aG9kIG9mIGFsbCBsaXN0ZW5pbmdcbiAgKiB3ZWJzb2NrZXRzLiBBZnRlciB0aGF0IGl0IHJlbW92ZXMgaXRzZWxmIGZyb20gdGhlIHVybE1hcCBzbyBhbm90aGVyIHNlcnZlclxuICAqIGNvdWxkIGFkZCBpdHNlbGYgdG8gdGhlIHVybC5cbiAgKlxuICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXG4gICovXG4gIGNsb3NlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvZGUsXG4gICAgICByZWFzb24sXG4gICAgICB3YXNDbGVhblxuICAgIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cCh0aGlzLnVybCk7XG5cbiAgICBsaXN0ZW5lcnMuZm9yRWFjaCgoc29ja2V0KSA9PiB7XG4gICAgICBzb2NrZXQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRTtcbiAgICAgIHNvY2tldC5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICB0eXBlOiAnY2xvc2UnLFxuICAgICAgICB0YXJnZXQ6IHNvY2tldCxcbiAgICAgICAgY29kZTogY29kZSB8fCBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwsXG4gICAgICAgIHJlYXNvbjogcmVhc29uIHx8ICcnLFxuICAgICAgICB3YXNDbGVhblxuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoeyB0eXBlOiAnY2xvc2UnIH0pLCB0aGlzKTtcbiAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVNlcnZlcih0aGlzLnVybCk7XG4gIH1cblxuICAvKlxuICAqIFJldHVybnMgYW4gYXJyYXkgb2Ygd2Vic29ja2V0cyB3aGljaCBhcmUgbGlzdGVuaW5nIHRvIHRoaXMgc2VydmVyXG4gICovXG4gIGNsaWVudHMoKSB7XG4gICAgcmV0dXJuIG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cCh0aGlzLnVybCk7XG4gIH1cblxuICAvKlxuICAqIFByZXBhcmVzIGEgbWV0aG9kIHRvIHN1Ym1pdCBhbiBldmVudCB0byBtZW1iZXJzIG9mIHRoZSByb29tXG4gICpcbiAgKiBlLmcuIHNlcnZlci50bygnbXktcm9vbScpLmVtaXQoJ2hpIScpO1xuICAqL1xuICB0byhyb29tLCBicm9hZGNhc3RlciwgYnJvYWRjYXN0TGlzdCA9IFtdKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd2Vic29ja2V0cyA9IGRlZHVwZShicm9hZGNhc3RMaXN0LmNvbmNhdChcbiAgICAgIG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cCh0aGlzLnVybCwgcm9vbSwgYnJvYWRjYXN0ZXIpXG4gICAgKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG86IChjaGFpbmVkUm9vbSwgY2hhaW5lZEJyb2FkY2FzdGVyKSA9PlxuICAgICAgICB0aGlzLnRvLmNhbGwodGhpcywgY2hhaW5lZFJvb20sIGNoYWluZWRCcm9hZGNhc3Rlciwgd2Vic29ja2V0cyksXG4gICAgICBlbWl0KGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHNlbGYuZW1pdChldmVudCwgZGF0YSwgeyB3ZWJzb2NrZXRzIH0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBBbGlhcyBmb3IgU2VydmVyLnRvXG4gICAqL1xuICBpbiguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMudG8uYXBwbHkobnVsbCwgYXJncyk7XG4gIH1cbn1cblxuLypcbiAqIEFsdGVybmF0aXZlIGNvbnN0cnVjdG9yIHRvIHN1cHBvcnQgbmFtZXNwYWNlcyBpbiBzb2NrZXQuaW9cbiAqXG4gKiBodHRwOi8vc29ja2V0LmlvL2RvY3Mvcm9vbXMtYW5kLW5hbWVzcGFjZXMvI2N1c3RvbS1uYW1lc3BhY2VzXG4gKi9cblNlcnZlci5vZiA9IGZ1bmN0aW9uIG9mKHVybCkge1xuICByZXR1cm4gbmV3IFNlcnZlcih1cmwpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgU2VydmVyO1xuIiwiaW1wb3J0IGRlbGF5IGZyb20gJy4vaGVscGVycy9kZWxheSc7XG5pbXBvcnQgRXZlbnRUYXJnZXQgZnJvbSAnLi9ldmVudC10YXJnZXQnO1xuaW1wb3J0IG5ldHdvcmtCcmlkZ2UgZnJvbSAnLi9uZXR3b3JrLWJyaWRnZSc7XG5pbXBvcnQgQ0xPU0VfQ09ERVMgZnJvbSAnLi9oZWxwZXJzL2Nsb3NlLWNvZGVzJztcbmltcG9ydCBub3JtYWxpemUgZnJvbSAnLi9oZWxwZXJzL25vcm1hbGl6ZS11cmwnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuL2hlbHBlcnMvbG9nZ2VyJztcbmltcG9ydCB7IGNyZWF0ZUV2ZW50LCBjcmVhdGVNZXNzYWdlRXZlbnQsIGNyZWF0ZUNsb3NlRXZlbnQgfSBmcm9tICcuL2V2ZW50LWZhY3RvcnknO1xuXG4vKlxuKiBUaGUgc29ja2V0LWlvIGNsYXNzIGlzIGRlc2lnbmVkIHRvIG1pbWljayB0aGUgcmVhbCBBUEkgYXMgY2xvc2VseSBhcyBwb3NzaWJsZS5cbipcbiogaHR0cDovL3NvY2tldC5pby9kb2NzL1xuKi9cbmNsYXNzIFNvY2tldElPIGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICAvKlxuICAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAgKi9cbiAgY29uc3RydWN0b3IodXJsID0gJ3NvY2tldC5pbycsIHByb3RvY29sID0gJycpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5iaW5hcnlUeXBlID0gJ2Jsb2InO1xuICAgIHRoaXMudXJsID0gbm9ybWFsaXplKHVybCk7XG4gICAgdGhpcy5yZWFkeVN0YXRlID0gU29ja2V0SU8uQ09OTkVDVElORztcbiAgICB0aGlzLnByb3RvY29sID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHByb3RvY29sID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm90b2NvbCkgJiYgcHJvdG9jb2wubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sWzBdO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgKiBEZWxheSB0cmlnZ2VyaW5nIHRoZSBjb25uZWN0aW9uIGV2ZW50cyBzbyB0aGV5IGNhbiBiZSBkZWZpbmVkIGluIHRpbWUuXG4gICAgKi9cbiAgICBkZWxheShmdW5jdGlvbiBkZWxheUNhbGxiYWNrKCkge1xuICAgICAgaWYgKHNlcnZlcikge1xuICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBTb2NrZXRJTy5PUEVOO1xuICAgICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdjb25uZWN0aW9uJyB9KSwgc2VydmVyLCB0aGlzKTtcbiAgICAgICAgc2VydmVyLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnY29ubmVjdCcgfSksIHNlcnZlciwgdGhpcyk7IC8vIGFsaWFzXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdjb25uZWN0JywgdGFyZ2V0OiB0aGlzIH0pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNvY2tldElPLkNMT1NFRDtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Vycm9yJywgdGFyZ2V0OiB0aGlzIH0pKTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICAgIHR5cGU6ICdjbG9zZScsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICAgIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgbG9nZ2VyKCdlcnJvcicsIGBTb2NrZXQuaW8gY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZGApO1xuICAgICAgfVxuICAgIH0sIHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICBBZGQgYW4gYWxpYXNlZCBldmVudCBsaXN0ZW5lciBmb3IgY2xvc2UgLyBkaXNjb25uZWN0XG4gICAgICovXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIChldmVudCkgPT4ge1xuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgIHRhcmdldDogZXZlbnQudGFyZ2V0LFxuICAgICAgICBjb2RlOiBldmVudC5jb2RlXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAqIENsb3NlcyB0aGUgU29ja2V0SU8gY29ubmVjdGlvbiBvciBjb25uZWN0aW9uIGF0dGVtcHQsIGlmIGFueS5cbiAgKiBJZiB0aGUgY29ubmVjdGlvbiBpcyBhbHJlYWR5IENMT1NFRCwgdGhpcyBtZXRob2QgZG9lcyBub3RoaW5nLlxuICAqL1xuICBjbG9zZSgpIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlICE9PSBTb2NrZXRJTy5PUEVOKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKHRoaXMudXJsKTtcbiAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldCh0aGlzLCB0aGlzLnVybCk7XG5cbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBTb2NrZXRJTy5DTE9TRUQ7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgdHlwZTogJ2Nsb3NlJyxcbiAgICAgIHRhcmdldDogdGhpcyxcbiAgICAgIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTFxuICAgIH0pKTtcblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgIHRhcmdldDogdGhpcyxcbiAgICAgICAgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMXG4gICAgICB9KSwgc2VydmVyKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIEFsaWFzIGZvciBTb2NrZXQjY2xvc2VcbiAgKlxuICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NrZXRpby9zb2NrZXQuaW8tY2xpZW50L2Jsb2IvbWFzdGVyL2xpYi9zb2NrZXQuanMjTDM4M1xuICAqL1xuICBkaXNjb25uZWN0KCkge1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuXG4gIC8qXG4gICogU3VibWl0cyBhbiBldmVudCB0byB0aGUgc2VydmVyIHdpdGggYSBwYXlsb2FkXG4gICovXG4gIGVtaXQoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlICE9PSBTb2NrZXRJTy5PUEVOKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NvY2tldElPIGlzIGFscmVhZHkgaW4gQ0xPU0lORyBvciBDTE9TRUQgc3RhdGUnKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlRXZlbnQgPSBjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgdHlwZTogZXZlbnQsXG4gICAgICBvcmlnaW46IHRoaXMudXJsLFxuICAgICAgZGF0YVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAodGhpcy51cmwpO1xuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgc2VydmVyLmRpc3BhdGNoRXZlbnQobWVzc2FnZUV2ZW50LCAuLi5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIFN1Ym1pdHMgYSAnbWVzc2FnZScgZXZlbnQgdG8gdGhlIHNlcnZlci5cbiAgKlxuICAqIFNob3VsZCBiZWhhdmUgZXhhY3RseSBsaWtlIFdlYlNvY2tldCNzZW5kXG4gICpcbiAgKiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vc29ja2V0LmlvLWNsaWVudC9ibG9iL21hc3Rlci9saWIvc29ja2V0LmpzI0wxMTNcbiAgKi9cbiAgc2VuZChkYXRhKSB7XG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSk7XG4gIH1cblxuICAvKlxuICAqIEZvciBicm9hZGNhc3RpbmcgZXZlbnRzIHRvIG90aGVyIGNvbm5lY3RlZCBzb2NrZXRzLlxuICAqXG4gICogZS5nLiBzb2NrZXQuYnJvYWRjYXN0LmVtaXQoJ2hpIScpO1xuICAqIGUuZy4gc29ja2V0LmJyb2FkY2FzdC50bygnbXktcm9vbScpLmVtaXQoJ2hpIScpO1xuICAqL1xuICBnZXQgYnJvYWRjYXN0KCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU29ja2V0SU8gaXMgYWxyZWFkeSBpbiBDTE9TSU5HIG9yIENMT1NFRCBzdGF0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKHRoaXMudXJsKTtcbiAgICBpZiAoIXNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb2NrZXRJTyBjYW4gbm90IGZpbmQgYSBzZXJ2ZXIgYXQgdGhlIHNwZWNpZmllZCBVUkwgKCR7dGhpcy51cmx9KWApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBlbWl0KGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHNlcnZlci5lbWl0KGV2ZW50LCBkYXRhLCB7IHdlYnNvY2tldHM6IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cChzZWxmLnVybCwgbnVsbCwgc2VsZikgfSk7XG4gICAgICB9LFxuICAgICAgdG8ocm9vbSkge1xuICAgICAgICByZXR1cm4gc2VydmVyLnRvKHJvb20sIHNlbGYpO1xuICAgICAgfSxcbiAgICAgIGluKHJvb20pIHtcbiAgICAgICAgcmV0dXJuIHNlcnZlci5pbihyb29tLCBzZWxmKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgKiBGb3IgcmVnaXN0ZXJpbmcgZXZlbnRzIHRvIGJlIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAqL1xuICBvbih0eXBlLCBjYWxsYmFjaykge1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKlxuICAgKiBKb2luIGEgcm9vbSBvbiBhIHNlcnZlclxuICAgKlxuICAgKiBodHRwOi8vc29ja2V0LmlvL2RvY3Mvcm9vbXMtYW5kLW5hbWVzcGFjZXMvI2pvaW5pbmctYW5kLWxlYXZpbmdcbiAgICovXG4gIGpvaW4ocm9vbSkge1xuICAgIG5ldHdvcmtCcmlkZ2UuYWRkTWVtYmVyc2hpcFRvUm9vbSh0aGlzLCByb29tKTtcbiAgfVxuXG4gIC8qXG4gICAqIEdldCB0aGUgd2Vic29ja2V0IHRvIGxlYXZlIHRoZSByb29tXG4gICAqXG4gICAqIGh0dHA6Ly9zb2NrZXQuaW8vZG9jcy9yb29tcy1hbmQtbmFtZXNwYWNlcy8jam9pbmluZy1hbmQtbGVhdmluZ1xuICAgKi9cbiAgbGVhdmUocm9vbSkge1xuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlTWVtYmVyc2hpcEZyb21Sb29tKHRoaXMsIHJvb20pO1xuICB9XG5cbiAgdG8ocm9vbSkge1xuICAgIHJldHVybiB0aGlzLmJyb2FkY2FzdC50byhyb29tKTtcbiAgfVxuXG4gIGluKCkge1xuICAgIHJldHVybiB0aGlzLnRvLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG5cbiAgLypcbiAgICogSW52b2tlcyBhbGwgbGlzdGVuZXIgZnVuY3Rpb25zIHRoYXQgYXJlIGxpc3RlbmluZyB0byB0aGUgZ2l2ZW4gZXZlbnQudHlwZSBwcm9wZXJ0eS4gRWFjaFxuICAgKiBsaXN0ZW5lciB3aWxsIGJlIHBhc3NlZCB0aGUgZXZlbnQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gZXZlbnQgLSBldmVudCBvYmplY3Qgd2hpY2ggd2lsbCBiZSBwYXNzZWQgdG8gYWxsIGxpc3RlbmVycyBvZiB0aGUgZXZlbnQudHlwZSBwcm9wZXJ0eVxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudCwgLi4uY3VzdG9tQXJndW1lbnRzKSB7XG4gICAgY29uc3QgZXZlbnROYW1lID0gZXZlbnQudHlwZTtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVyc1tldmVudE5hbWVdO1xuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3RlbmVycykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lcnMuZm9yRWFjaCgobGlzdGVuZXIpID0+IHtcbiAgICAgIGlmIChjdXN0b21Bcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBjdXN0b21Bcmd1bWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUmVndWxhciBXZWJTb2NrZXRzIGV4cGVjdCBhIE1lc3NhZ2VFdmVudCBidXQgU29ja2V0aW8uaW8ganVzdCB3YW50cyByYXcgZGF0YVxuICAgICAgICAvLyAgcGF5bG9hZCBpbnN0YW5jZW9mIE1lc3NhZ2VFdmVudCB3b3JrcywgYnV0IHlvdSBjYW4ndCBpc250YW5jZSBvZiBOb2RlRXZlbnRcbiAgICAgICAgLy8gIGZvciBub3cgd2UgZGV0ZWN0IGlmIHRoZSBvdXRwdXQgaGFzIGRhdGEgZGVmaW5lZCBvbiBpdFxuICAgICAgICBsaXN0ZW5lci5jYWxsKHRoaXMsIGV2ZW50LmRhdGEgPyBldmVudC5kYXRhIDogZXZlbnQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cblNvY2tldElPLkNPTk5FQ1RJTkcgPSAwO1xuU29ja2V0SU8uT1BFTiA9IDE7XG5Tb2NrZXRJTy5DTE9TSU5HID0gMjtcblNvY2tldElPLkNMT1NFRCA9IDM7XG5cbi8qXG4qIFN0YXRpYyBjb25zdHJ1Y3RvciBtZXRob2RzIGZvciB0aGUgSU8gU29ja2V0XG4qL1xuY29uc3QgSU8gPSBmdW5jdGlvbiBpb0NvbnN0cnVjdG9yKHVybCkge1xuICByZXR1cm4gbmV3IFNvY2tldElPKHVybCk7XG59O1xuXG4vKlxuKiBBbGlhcyB0aGUgcmF3IElPKCkgY29uc3RydWN0b3JcbiovXG5JTy5jb25uZWN0ID0gZnVuY3Rpb24gaW9Db25uZWN0KHVybCkge1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuZXctY2FwICovXG4gIHJldHVybiBJTyh1cmwpO1xuICAvKiBlc2xpbnQtZW5hYmxlIG5ldy1jYXAgKi9cbn07XG5cbmV4cG9ydCBkZWZhdWx0IElPO1xuIiwiaW1wb3J0IE1vY2tTZXJ2ZXIgZnJvbSAnLi9zZXJ2ZXInO1xuaW1wb3J0IE1vY2tTb2NrZXRJTyBmcm9tICcuL3NvY2tldC1pbyc7XG5pbXBvcnQgTW9ja1dlYlNvY2tldCBmcm9tICcuL3dlYnNvY2tldCc7XG5cbmV4cG9ydCBjb25zdCBTZXJ2ZXIgPSBNb2NrU2VydmVyO1xuZXhwb3J0IGNvbnN0IFdlYlNvY2tldCA9IE1vY2tXZWJTb2NrZXQ7XG5leHBvcnQgY29uc3QgU29ja2V0SU8gPSBNb2NrU29ja2V0SU87XG4iXSwibmFtZXMiOlsiY29uc3QiLCJ0aGlzIiwic3VwZXIiLCJXZWJTb2NrZXQiLCJub3JtYWxpemUiLCJsb2dnZXIiLCJDTE9TRV9DT0RFUyIsIlNlcnZlciIsImdsb2JhbE9iamVjdCIsIlNvY2tldElPIiwiTW9ja1NlcnZlciIsIk1vY2tXZWJTb2NrZXQiLCJNb2NrU29ja2V0SU8iXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7O0FBUUEsQUFBZSxTQUFTLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0VBQy9DLFVBQVUsQ0FBQyxVQUFBLGNBQWMsRUFBQyxTQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUEsRUFBRSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7Q0FDekU7O0FDVk0sU0FBUyxNQUFNLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRTtFQUN0Q0EsSUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO0VBQ25CLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBQyxXQUFXLEVBQUU7SUFDMUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRTtNQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0tBQzNCO0dBQ0YsQ0FBQyxDQUFDOztFQUVILE9BQU8sT0FBTyxD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
