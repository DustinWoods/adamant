const EventEmitter = require('events');

class LoopService extends EventEmitter {

	/**
	 * Creates a LoopService object
	 * A LoopService object will run a function continuously when start() is triggered.
	 * It will stop when stop() is called, an error is caught, or has reached a run limit.
	 *
	 * @param {function} run_callback - The function to run continuously. Can be a Promise-returning function.
	 * @param {function} stop_callback - The function that will run when run_callback stops
	 */
	constructor(run_callback, stop_callback) {
		super();

		//Set initial variables
		this.run_flag = false;
		this.run_status = false;
		this.run_callback = run_callback;
		this.stop_callback = stop_callback;
		this.run_count = 0;
		this.stop_on_run = 0;

	}


	/**
	 * Checks if the LoopService object is running
	 *
	 * @return {boolean} True if running, False if not
	 */
	get is_running() {
		return this.run_status;
	}

	/**
	 * Checks if LoopService object should proceed to execute run_callback
	 *
	 * @return {boolean} True if running, False if not
	 */
	get _should_run() {

		//Should not run if stop_on_run count is reached
		if(this.stop_on_run && this.run_count >= this.stop_on_run) {
			return false;
		}

		//Should not run if run_flag isn't set
		if(!this.run_flag) {
			return false;
		}

		//Proceed
		return true;

	}


	/**
	 * Initiates the LoopService to begin running.
	 *
	 * @param {boolean} run_once - If True, LoopService will only execute run_callback once, and not continuously.
	 * @return {Promise} Resolves or rejects when LoopService stops
	 */
	start(run_once = false) {

		//Don't start if already running
		if(this.run_flag) {
			return;
		}

		//Set flag
		this.run_flag = true;

		//Set stop if we are only running once
		if(run_once) {
			this.stop_on_run = this.run_count + 1;
		}

		// Trigger start event
		this.emit('started');

		return new Promise((resolve, reject) => {
			// Loop function
			let loopfn = (function() {

				// Check if need to keep running
				if(!this._should_run) {
					resolve();
					return;
				}

				// Increment run count
				this.run_count++;

				// Try to call run_callback
				try {
					Promise.resolve(this.run_callback()).catch(reject).then(() => {
						// If all went well, let's do it again!
						setImmediate(loopfn);
					});
				} catch(e) {
					// Send up error
					reject(e);
				}
				// That's it!
				return;

			}).bind(this); // Make sure to bind function to this

			// Start the loop
			setImmediate(loopfn);

		})
		.catch((e) => {
			// Turn errors into emitted event
			this.emit('error', e);
		})
		.then(() => {
			if(typeof this.stop_callback === 'function') {
				return this.stop_callback();
			}
		})
		.then(() => {
			this.run_status = false;
			this.stop_on_run = 0;
			this.run_flag = false;

			//Emit stopped event
			this.emit('stopped'); //<-- Note, if error is thrown in handlers of this event, it will need to be caught by the code that executes start()

		});

	}

	/**
	 * Initiates the LoopService to stop running.
	 *
	 * @todo Implement promise return
	 * @return {Promise} Resolves or rejects when LoopService complete the stop
	 */
	stop() {
		this.run_flag = false;
	}
}

module.exports = LoopService;