/**
 * Copyright (c) 2015, Blocshop s.r.o.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms are permitted
 * provided that the above copyright notice and this paragraph are
 * duplicated in all such forms and that any documentation,
 * advertising materials, and other materials related to such
 * distribution and use acknowledge that the software was developed
 * by the Blocshop s.r.o.. The name of the
 * Blocshop s.r.o. may not be used to endorse or promote products derived
 * from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND WITHOUT ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, WITHOUT LIMITATION, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 */

const { connect } = require("tls");

var SOCKET_EVENT = "SOCKET_EVENT";
var CORDOVA_SERVICE_NAME = "SocketsForCordova";

Socket.State = {};
Socket.State[(Socket.State.CLOSED = 0)] = "CLOSED";
Socket.State[(Socket.State.OPENING = 1)] = "OPENING";
Socket.State[(Socket.State.OPENED = 2)] = "OPENED";
Socket.State[(Socket.State.CLOSING = 3)] = "CLOSING";

function Socket() {
  this._state = Socket.State.CLOSED;
  this.onData = null;
  this.onClose = null;
  this.onError = null;
  this.socketKey = guid();
  this.client = null;
}

Socket.prototype.open = function (host, port, success, error){
  success = success || function () {};


  if (!this._ensureState(Socket.State.CLOSED, error)) {
    return;
  }

  this._state = Socket.State.OPENING;

  const client = connect(port, host, {ca: {}, rejectUnauthorized: false}, () => {
    if (client.authorized) {
      this._state = Socket.State.OPENED;
      success();
    } else {
      error("Error: " + client.authorizationError);
    }
  });

  client.on("data", (data) => {
    console.log(
      "Received: %s [it is %d bytes long]",
      data.toString().replace(/(\n)/gm, ""),
      data.length
    );
    this.onData(new Uint8Array(data));
  });
  client.on("close", () => {
    this._state = Socket.State.CLOSED;
    this.onClose();
    console.log("Connection closed");
  });
  // When an error ocoures, show it.
  client.on("error", (error) => {
    console.error(error);
    this.onError(error);
    // Close the connection after the error occurred.
    client.destroy();
  });

  this.client = client;
};

Socket.prototype.write = function (data, success, error) {
  success = success || function () {};
  error = error || function () {};

  if (!this._ensureState(Socket.State.OPENED, error)) {
    return;
  }

  var dataToWrite =
    data instanceof Uint8Array ? Socket._copyToArray(data) : data;

  this.client.write(dataToWrite, (err) => {
    if (err) {
      error();
    } else {
      success();
    }
  });
};

Socket.prototype.shutdownWrite = function (success, error) {
  success = success || function () {};
  error = error || function () {};

  if (!this._ensureState(Socket.State.OPENED, error)) {
    return;
  }

  this.client.shutdownWrite(dataToWrite, (err) => {
    if (err) {
      error();
    } else {
      success();
    }
  });
};

Socket.prototype.close = function (success, error, force = false) {
  success = success || function () {};
  error = error || function () {};

  if (!force && !this._ensureState(Socket.State.OPENED, error)) {
    return;
  }

  this._state = Socket.State.CLOSING;
  this.client.end(() => {
    success();
  });
};

Object.defineProperty(Socket.prototype, "state", {
  get: function () {
    return this._state;
  },
  enumerable: true,
  configurable: true,
});

Socket.prototype._ensureState = function (requiredState, errorCallback) {
  var state = this._state;
  if (state != requiredState) {
    window.setTimeout(function () {
      errorCallback(
        "Invalid operation for this socket state: " + Socket.State[state]
      );
    });
    return false;
  } else {
    return true;
  }
};

Socket._copyToArray = (array) => {
  var outputArray = new Array(array.length);
  for (var i = 0; i < array.length; i++) {
    outputArray[i] = array[i];
  }
  return outputArray;
};

var guid = (() => {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return () => {
    return (
      s4() +
      s4() +
      "-" +
      s4() +
      "-" +
      s4() +
      "-" +
      s4() +
      "-" +
      s4() +
      s4() +
      s4()
    );
  };
})();

module.exports = Socket;
