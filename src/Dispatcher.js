/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * Source: https://github.com/facebook/flux/blob/39064d9ce4a80f860bec20baf90170e4b9bf35bc/src/Dispatcher.js
 */

import invariant from 'invariant';

/** @typedef {string} DispatchToken */
/** @typedef {(payload: TPayload) => void} Callback */

const _prefix = 'ID_';

/**
 * Dispatcher is used to broadcast payloads to registered callbacks. This is
 * different from generic pub-sub systems in two ways:
 *
 *   1) Callbacks are not subscribed to particular events. Every payload is
 *      dispatched to every registered callback.
 *   2) Callbacks can be deferred in whole or part until other callbacks have
 *      been executed.
 *
 * For example, consider this hypothetical flight destination form, which
 * selects a default city when a country is selected:
 *
 *   var flightDispatcher = new Dispatcher();
 *
 *   // Keeps track of which country is selected
 *   var CountryStore = {country: null};
 *
 *   // Keeps track of which city is selected
 *   var CityStore = {city: null};
 *
 *   // Keeps track of the base flight price of the selected city
 *   var FlightPriceStore = {price: null}
 *
 * When a user changes the selected city, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'city-update',
 *     selectedCity: 'paris'
 *   });
 *
 * This payload is digested by `CityStore`:
 *
 *   flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'city-update') {
 *       CityStore.city = payload.selectedCity;
 *     }
 *   });
 *
 * When the user selects a country, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'country-update',
 *     selectedCountry: 'australia'
 *   });
 *
 * This payload is digested by both stores:
 *
 *   CountryStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       CountryStore.country = payload.selectedCountry;
 *     }
 *   });
 *
 * When the callback to update `CountryStore` is registered, we save a reference
 * to the returned token. Using this token with `waitFor()`, we can guarantee
 * that `CountryStore` is updated before the callback that updates `CityStore`
 * needs to query its data.
 *
 *   CityStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       // `CountryStore.country` may not be updated.
 *       flightDispatcher.waitFor([CountryStore.dispatchToken]);
 *       // `CountryStore.country` is now guaranteed to be updated.
 *
 *       // Select the default city for the new country
 *       CityStore.city = getDefaultCityForCountry(CountryStore.country);
 *     }
 *   });
 *
 * The usage of `waitFor()` can be chained, for example:
 *
 *   FlightPriceStore.dispatchToken =
 *     flightDispatcher.register(function(payload) {
 *       switch (payload.actionType) {
 *         case 'country-update':
 *         case 'city-update':
 *           flightDispatcher.waitFor([CityStore.dispatchToken]);
 *           FlightPriceStore.price =
 *             getFlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *     }
 *   });
 *
 * The `country-update` payload will be guaranteed to invoke the stores'
 * registered callbacks in order: `CountryStore`, `CityStore`, then
 * `FlightPriceStore`.
 * @template TPayload
 * @param {any} TPayload -
 */
export default class Dispatcher {
	/** @type {[key: DispatchToken]: Callback} */
	_callbacks;
	/** @type {boolean} */
	_isDispatching;
	/** @type {[key: DispatchToken]: boolean} */
	_isHandled;
	/** @type {[key: DispatchToken]: boolean} */
	_isPending;
	/** @type {number} */
	_lastID;
	/** @type {TPayload} */
	_pendingPayload;

	constructor() {
		this._callbacks = {};
		this._isDispatching = false;
		this._isHandled = {};
		this._isPending = {};
		this._lastID = 1;
	}

	/**
	 * Registers a callback to be invoked with every dispatched payload. Returns
	 * a token that can be used with `waitFor()`.
	 * @param {Callback} callback -
	 * @returns {DispatchToken} -
	 */
	register(callback) {
		const id = _prefix + this._lastID++;
		this._callbacks[id] = callback;
		return id;
	}

	/**
	 * Removes a callback based on its token.
	 * @param {DispatchToken} id -
	 * @returns {void}
	 */
	unregister(id) {
		invariant(
			this._callbacks[id],
			'Dispatcher.unregister(...): `%s` does not map to a registered callback.',
			id
		);
		delete this._callbacks[id];
	}

	/**
	 * Waits for the callbacks specified to be invoked before continuing execution
	 * of the current callback. This method should only be used by a callback in
	 * response to a dispatched payload.
	 * @param {DispatchToken[]} ids -
	 * @returns {void}
	 */
	waitFor(ids) {
		invariant(
			this._isDispatching,
			'Dispatcher.waitFor(...): Must be invoked while dispatching.'
		);
		for (let ii = 0; ii < ids.length; ii++) {
			let id = ids[ii];
			if (this._isPending[id]) {
				invariant(
					this._isHandled[id],
					'Dispatcher.waitFor(...): Circular dependency detected while ' +
						'waiting for `%s`.',
					id
				);
				continue;
			}
			invariant(
				this._callbacks[id],
				'Dispatcher.waitFor(...): `%s` does not map to a registered callback.',
				id
			);
			this._invokeCallback(id);
		}
	}

	/**
	 * Dispatches a payload to all registered callbacks.
	 * @param {TPayload} payload -
	 * @returns {void}
	 */
	dispatch(payload) {
		invariant(
			!this._isDispatching,
			'Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.'
		);
		this._startDispatching(payload);
		try {
			for (let id in this._callbacks) {
				if (this._isPending[id]) {
					continue;
				}
				this._invokeCallback(id);
			}
		} finally {
			this._stopDispatching();
		}
	}

	/**
	 * @returns {boolean} Is this Dispatcher currently dispatching.
	 */
	isDispatching() {
		return this._isDispatching;
	}

	/**
	 * Call the callback stored with the given id. Also do some internal
	 * bookkeeping.
	 *
	 * @internal
	 * @param {DispatchToken} id -
	 * @returns {void}
	 */
	_invokeCallback(id) {
		this._isPending[id] = true;
		this._callbacks[id](this._pendingPayload);
		this._isHandled[id] = true;
	}

	/**
	 * Set up bookkeeping needed when dispatching.
	 *
	 * @internal
	 * @param {TPayload} payload -
	 * @returns {void}
	 */
	_startDispatching(payload) {
		// eslint-disable-next-line guard-for-in
		for (const id in this._callbacks) {
			this._isPending[id] = false;
			this._isHandled[id] = false;
		}
		this._pendingPayload = payload;
		this._isDispatching = true;
	}

	/**
	 * Clear bookkeeping used for dispatching.
	 *
	 * @internal
	 * @returns {void}
	 */
	_stopDispatching() {
		delete this._pendingPayload;
		this._isDispatching = false;
	}
}
