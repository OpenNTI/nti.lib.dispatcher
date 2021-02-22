import invariant from 'invariant';

import Dispatcher from './Dispatcher';

class AppDispatcher extends Dispatcher {
	constructor() {
		super();
	}

	/**
	 * A bridge function between the views and the dispatcher, marking the action
	 * as a view action.
	 * @param  {Object} action The data coming from the view.
	 * @returns {void}
	 */
	handleViewAction(action) {
		// console.log('AppDispatcher::handleViewAction: %s', action.type);

		if (process.env.NODE_ENV !== 'production') {
			invariant(action.type, 'Expected there to be an action.type');
		}

		this.dispatch({
			source: 'VIEW_ACTION',
			action: action,
		});
	}

	/**
	 * A bridge function between the views and the dispatcher, marking the action
	 * as a request action.
	 * @param  {Object} action The data coming from the request response.
	 * @returns {void}
	 */
	handleRequestAction(action) {
		let payload = {
			source: 'REQUEST_ACTION',
			action: action,
		};

		if (process.env.NODE_ENV !== 'production') {
			invariant(action.type, 'Expected there to be an action.type');
		}

		if (this.isDispatching()) {
			return void setTimeout(() => this.dispatch(payload), 0);
		}

		this.dispatch(payload);
	}
}

const singleton = new AppDispatcher();
export default singleton;

export function dispatch(type, response) {
	singleton.handleRequestAction({ type, response });
	return response;
}
