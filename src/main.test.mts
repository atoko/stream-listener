// import {
//   afterAll,
//   afterEach,
//   beforeAll,
//   describe,
//   expect,
//   jest,
//   test,
// } from "@jest/globals";
// import { mkdirSync, rmSync, writeFileSync } from "fs";
// import { tmpdir } from "node:os";
// import { join } from "node:path";
// import { beforeEach } from "node:test";
// import { CONFIGURATION, TWITCH_ENVIRONMENT } from "../configuration.mts";
//
// const mocks = ({
//   httpsServer,
//   wssServer,
//   plugin,
//   http,
//   irc,
//   caster,
// }: {
//   httpsServer?: boolean;
//   wssServer?: boolean;
//   plugin?: boolean;
//   http?: boolean;
//   irc?: boolean;
//   caster?: boolean;
// }) => {
//   return {
//     httpsServer: httpsServer
//       ? jest.requireMock("http/service.mts")
//       : jest.requireActual("http/server"),
//     wssServer: wssServer
//       ? jest.requireMock("http/websocket.mts")
//       : jest.requireActual(""),
//     plugin: plugin ? jest.requireMock("") : jest.requireActual(""),
//     http: http ? jest.requireActual("http") : jest.requireActual("http"),
//     irc: irc ? jest.requireActual("irc") : jest.requireActual("irc"),
//     caster: jest.fn(),
//   } as const;
// };
//
//
