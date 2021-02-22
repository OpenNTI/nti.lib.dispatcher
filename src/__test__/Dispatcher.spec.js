/* eslint-env jest */
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import Dispatcher from '../Dispatcher';

describe('Dispatcher', () => {
	let dispatcher;
	let callbackA;
	let callbackB;

	beforeEach(() => {
		dispatcher = new Dispatcher();
		callbackA = jest.fn();
		callbackB = jest.fn();
	});

	test('should execute all subscriber callbacks', () => {
		dispatcher.register(callbackA);
		dispatcher.register(callbackB);

		let payload = {};
		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(1);
		expect(callbackA.mock.calls[0][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(1);
		expect(callbackB.mock.calls[0][0]).toBe(payload);

		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(2);
		expect(callbackA.mock.calls[1][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(2);
		expect(callbackB.mock.calls[1][0]).toBe(payload);
	});

	test('should wait for callbacks registered earlier', () => {
		let tokenA = dispatcher.register(callbackA);

		dispatcher.register(payload => {
			dispatcher.waitFor([tokenA]);
			expect(callbackA.mock.calls.length).toBe(1);
			expect(callbackA.mock.calls[0][0]).toBe(payload);
			callbackB(payload);
		});

		let payload = {};
		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(1);
		expect(callbackA.mock.calls[0][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(1);
		expect(callbackB.mock.calls[0][0]).toBe(payload);
	});

	test('should wait for callbacks registered later', () => {
		let tokenB;
		dispatcher.register(payload => {
			dispatcher.waitFor([tokenB]);
			expect(callbackB.mock.calls.length).toBe(1);
			expect(callbackB.mock.calls[0][0]).toBe(payload);
			callbackA(payload);
		});

		tokenB = dispatcher.register(callbackB);

		let payload = {};
		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(1);
		expect(callbackA.mock.calls[0][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(1);
		expect(callbackB.mock.calls[0][0]).toBe(payload);
	});

	test('should throw if dispatch() while dispatching', () => {
		dispatcher.register(payload => {
			dispatcher.dispatch(payload);
			callbackA();
		});

		let payload = {};
		expect(() => dispatcher.dispatch(payload)).toThrow();
		expect(callbackA.mock.calls.length).toBe(0);
	});

	test('should throw if waitFor() while not dispatching', () => {
		let tokenA = dispatcher.register(callbackA);

		expect(() => dispatcher.waitFor([tokenA])).toThrow();
		expect(callbackA.mock.calls.length).toBe(0);
	});

	test('should throw if waitFor() with invalid token', () => {
		let invalidToken = 1337;

		dispatcher.register(() => {
			dispatcher.waitFor([invalidToken]);
		});

		let payload = {};
		expect(() => dispatcher.dispatch(payload)).toThrow();
	});

	test('should throw on self-circular dependencies', () => {
		let tokenA = dispatcher.register(payload => {
			dispatcher.waitFor([tokenA]);
			callbackA(payload);
		});

		let payload = {};
		expect(() => dispatcher.dispatch(payload)).toThrow();
		expect(callbackA.mock.calls.length).toBe(0);
	});

	test('should throw on multi-circular dependencies', () => {
		let tokenB;
		let tokenA = dispatcher.register(payload => {
			dispatcher.waitFor([tokenB]);
			callbackA(payload);
		});

		tokenB = dispatcher.register(payload => {
			dispatcher.waitFor([tokenA]);
			callbackB(payload);
		});

		expect(() => dispatcher.dispatch({})).toThrow();
		expect(callbackA.mock.calls.length).toBe(0);
		expect(callbackB.mock.calls.length).toBe(0);
	});

	test('should remain in a consistent state after a failed dispatch', () => {
		dispatcher.register(callbackA);
		dispatcher.register(payload => {
			if (payload.shouldThrow) {
				throw new Error();
			}
			callbackB();
		});

		expect(() => dispatcher.dispatch({ shouldThrow: true })).toThrow();

		// Cannot make assumptions about a failed dispatch.
		let callbackACount = callbackA.mock.calls.length;

		dispatcher.dispatch({ shouldThrow: false });

		expect(callbackA.mock.calls.length).toBe(callbackACount + 1);
		expect(callbackB.mock.calls.length).toBe(1);
	});

	test('should properly unregister callbacks', () => {
		dispatcher.register(callbackA);

		let tokenB = dispatcher.register(callbackB);

		let payload = {};
		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(1);
		expect(callbackA.mock.calls[0][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(1);
		expect(callbackB.mock.calls[0][0]).toBe(payload);

		dispatcher.unregister(tokenB);

		dispatcher.dispatch(payload);

		expect(callbackA.mock.calls.length).toBe(2);
		expect(callbackA.mock.calls[1][0]).toBe(payload);

		expect(callbackB.mock.calls.length).toBe(1);
	});
});
