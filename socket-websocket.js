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
    this._ws = null;
}

Socket.prototype.open = function (host, port, ssl = true, success, error) {
    success = success || function () { };
    error = error || function () { };

    if (!this._ensureState(Socket.State.CLOSED, error)) {
        return;
    }

    var _that = this;
    this._state = Socket.State.OPENING;

    try {
        var protocol = ssl ? "wss" : "ws";
        var url = protocol + "://" + host + ":" + port;

        this._ws = new WebSocket(url);
        this._ws.binaryType = "arraybuffer";

        this._ws.onopen = function () {
            _that._state = Socket.State.OPENED;
            success();
        };

        this._ws.onmessage = function (event) {
            if (_that.onData) {
                _that.onData(new Uint8Array(event.data));
            }
        };

        this._ws.onerror = function (event) {
            // WebSocket error events don't always contain descriptive messages
            var msg = "WebSocket error";
            if (_that.onError) {
                _that.onError(msg);
            }
            // If error happens during opening, we should probably call the error callback
            if (_that._state === Socket.State.OPENING) {
                _that._state = Socket.State.CLOSED;
                error(msg);
            }
        };

        this._ws.onclose = function (event) {
            _that._state = Socket.State.CLOSED;
            if (_that.onClose) {
                _that.onClose(event.code !== 1000); // 1000 is normal closure
            }
            _that._ws = null;
        };

    } catch (e) {
        this._state = Socket.State.CLOSED;
        error(e.message);
    }
};

Socket.prototype.write = function (data, success, error) {
    success = success || function () { };
    error = error || function () { };

    if (!this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    try {
        this._ws.send(data);
        success();
    } catch (e) {
        error(e.message);
    }
};

Socket.prototype.shutdownWrite = function (success, error) {
    success = success || function () { };
    error = error || function () { };

    if (!this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    // WebSockets don't support half-close (shutdownWrite).
    // We treat this as a no-op or we could log a warning.
    // For compatibility with the interface, we just call success.
    console.warn("Socket.shutdownWrite is not supported by native WebSockets.");
    success();
};

Socket.prototype.close = function (success, error, force = false) {
    success = success || function () { };
    error = error || function () { };

    if (!force && !this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    this._state = Socket.State.CLOSING;

    try {
        if (this._ws) {
            this._ws.close();
        }
        success();
    } catch (e) {
        error(e.message);
    }
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

var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
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
