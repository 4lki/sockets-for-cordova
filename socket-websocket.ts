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

export enum SocketState {
    CLOSED = 0,
    OPENING = 1,
    OPENED = 2,
    CLOSING = 3,
}

export class Socket {
    public static State = SocketState;

    private _state: SocketState;
    public onData: ((data: Uint8Array) => void) | null;
    public onClose: ((hasError: boolean) => void) | null;
    public onError: ((message: string) => void) | null;
    public readonly socketKey: string;
    private _ws: WebSocket | null;

    constructor() {
        this._state = SocketState.CLOSED;
        this.onData = null;
        this.onClose = null;
        this.onError = null;
        this.socketKey = this.guid();
        this._ws = null;
    }

    public open(
        host: string,
        port: number,
        ssl: boolean = true,
        success: () => void = () => { },
        error: (err: string) => void = () => { }
    ): void {
        if (!this._ensureState(SocketState.CLOSED, error)) {
            return;
        }

        this._state = SocketState.OPENING;

        try {
            const protocol = ssl ? "wss" : "ws";
            const url = `${protocol}://${host}:${port}`;

            this._ws = new WebSocket(url);
            this._ws.binaryType = "arraybuffer";

            this._ws.onopen = () => {
                this._state = SocketState.OPENED;
                success();
            };

            this._ws.onmessage = (event: MessageEvent) => {
                if (this.onData) {
                    this.onData(new Uint8Array(event.data as ArrayBuffer));
                }
            };

            this._ws.onerror = (event: Event) => {
                const msg = "WebSocket error";
                if (this.onError) {
                    this.onError(msg);
                }
                if (this._state === SocketState.OPENING) {
                    this._state = SocketState.CLOSED;
                    error(msg);
                }
            };

            this._ws.onclose = (event: CloseEvent) => {
                this._state = SocketState.CLOSED;
                if (this.onClose) {
                    this.onClose(event.code !== 1000);
                }
                this._ws = null;
            };
        } catch (e: any) {
            this._state = SocketState.CLOSED;
            error(e.message || "Unknown error");
        }
    }

    public write(
        data: Uint8Array | any,
        success: () => void = () => { },
        error: (err: string) => void = () => { }
    ): void {
        if (!this._ensureState(SocketState.OPENED, error)) {
            return;
        }

        try {
            if (this._ws) {
                this._ws.send(data);
                success();
            } else {
                error("WebSocket is not initialized");
            }
        } catch (e: any) {
            error(e.message || "Unknown error");
        }
    }

    public shutdownWrite(
        success: () => void = () => { },
        error: (err: string) => void = () => { }
    ): void {
        if (!this._ensureState(SocketState.OPENED, error)) {
            return;
        }

        console.warn("Socket.shutdownWrite is not supported by native WebSockets.");
        success();
    }

    public close(
        success: () => void = () => { },
        error: (err: string) => void = () => { },
        force: boolean = false
    ): void {
        if (!force && !this._ensureState(SocketState.OPENED, error)) {
            return;
        }

        this._state = SocketState.CLOSING;

        try {
            if (this._ws) {
                this._ws.close();
            }
            success();
        } catch (e: any) {
            error(e.message || "Unknown error");
        }
    }

    public get state(): SocketState {
        return this._state;
    }

    private _ensureState(
        requiredState: SocketState,
        errorCallback: (err: string) => void
    ): boolean {
        const state = this._state;
        if (state !== requiredState) {
            window.setTimeout(() => {
                errorCallback(
                    `Invalid operation for this socket state: ${SocketState[state]}`
                );
            });
            return false;
        } else {
            return true;
        }
    }

    private guid(): string {
        function s4(): string {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

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
    }
}
