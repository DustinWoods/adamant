const // Test tools
  chai = require('chai'),
  expect = chai.expect,
  assert = chai.assert,
  chaiSubset = require('chai-subset'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  _ = require('lodash'),
  // Modules to test
  EventHandleError = require('../libs/errors').EventHandleError,
  EventHandler = rewire('../libs/event-handler'),
  EventDispatcher = rewire('../libs/event-dispatcher'),
  Event = rewire('../libs/event'),
  EventComplete = require('../libs/event-complete');

chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();

const immmediatePromise = () => {
  return new Promise(resolve => {
    setImmediate(resolve);
  })
};

console_log_spy = sinon.stub().callsFake(console.log);
EventHandler.__set__('console', { log: console_log_spy });
EventDispatcher.__set__('console', { log: console_log_spy });
Event.__set__('console', { log: console_log_spy });


describe('Event System - ', () => {
  // Need some spies and a mock handler for running tests
  const test_1_dispatch_cb = sinon.spy();
  const test_1_revert_cb = sinon.spy();
  const test_2_dispatch_cb = sinon.spy();
  const test_2_revert_cb = sinon.spy();
  const test_3_dispatch_cb = sinon.spy();
  const test_3_revert_cb = sinon.spy();

  class test_1_handler_class extends EventHandler {
    constructor(args) {
      super();
      this.default_args = {};

      // Merges args with default args
      Object.assign(this.args, this.default_args, args);

      this.event_name = 'test.event_1';
      this.supports_revert = true;
    }
    dispatch() {
      test_1_dispatch_cb.apply(this, arguments);
    }
    revert() {
      test_1_revert_cb.apply(this, arguments);
    }
  }

  class test_2_handler_class extends EventHandler {
    constructor(args) {
      super();
      this.default_args = {};

      // Merges args with default args
      Object.assign(this.args, this.default_args, args);

      this.event_name = 'test.event_2';
      this.supports_revert = true;
    }
    dispatch() {
      test_2_dispatch_cb.apply(this, arguments);
    }
    revert() {
      test_2_revert_cb.apply(this, arguments);
    }
  }

  class test_3_handler_class extends EventHandler {
    constructor(args) {
      super();
      this.default_args = {};

      // Merges args with default args
      Object.assign(this.args, this.default_args, args);

      this.event_name = 'test.event_2';
      this.supports_revert = true;
    }
    dispatch() {
      test_3_dispatch_cb.apply(this, arguments);
    }
    revert() {
      test_3_revert_cb.apply(this, arguments);
    }
  }

  const test_handler_1 = new test_1_handler_class();
  const test_handler_2 = new test_2_handler_class();
  const test_handler_3 = new test_3_handler_class();
  const test_handler_4 = new test_3_handler_class();

  describe('Event Handler', () => {
    it('Should create two Event Handler instances', () => {
      expect(test_handler_1).to.be.instanceof(EventHandler);
      expect(test_handler_2).to.be.instanceof(EventHandler);
    });

    it('Should call dispatch with data', () => {
      const sample_data = Math.random();
      test_handler_1.dispatch(sample_data);
      sinon.assert.calledOnce(test_1_dispatch_cb);
      sinon.assert.calledWith(test_1_dispatch_cb, sample_data);
    });

    it('Should call revert with data', () => {
      const sample_revert_data = Math.random();
      test_handler_1.revert(sample_revert_data);
      sinon.assert.calledOnce(test_1_revert_cb);
      sinon.assert.calledWith(test_1_revert_cb, sample_revert_data);
    });

    it('Should throw error if support_revert is false and revert() is called', () => {
      const test_handler_1 = new EventHandler();
      expect(test_handler_1.revert.bind(test_handler_1)).to.throw(
        'Handler does not support revert.'
      );
    });

    describe('Default behaviors of overridable methods', () => {
      let instance = new EventHandler();
      it('Dispatch() should return nothing', () => {
        expect(instance.dispatch()).to.be.undefined;
      });
      it('Revert() should return nothing if support_revert = true', () => {
        instance.supports_revert = true;
        expect(instance.revert()).to.be.undefined;
        expect(instance.revert.bind(instance)).to.not.throw();
      });
    });
  });

  describe('Event Dispatcher', () => {
    const dispatcher = new EventDispatcher();

    // Create some random data to enqueue event with
    const test_1_event_data = Math.random();
    const test_2_event_data = Math.random();
    const test_3_event_data = Math.random();

    let test_1_event = {};
    let test_2_event = {};
    let test_3_event = {};

    let event_handler_id_1,
      event_handler_id_2,
      event_handler_id_3,
      event_handler_id_4;
    let event_id_1, event_id_2, event_id_3;

    afterEach(() => {
      test_1_dispatch_cb.reset();
      test_1_revert_cb.reset();
      test_2_dispatch_cb.reset();
      test_2_revert_cb.reset();
      test_3_dispatch_cb.reset();
      test_3_revert_cb.reset();
    });

    it('Should add event handler to dispatcher', () => {
      // Check dispatcher event handler array
      event_handler_id_1 = dispatcher.load_event_handler(test_handler_1);
      event_handler_id_2 = dispatcher.load_event_handler(test_handler_2);
      event_handler_id_3 = dispatcher.load_event_handler(test_handler_3);
      event_handler_id_4 = dispatcher.load_event_handler(test_handler_4);
      expect(dispatcher.event_handlers).to.contain(test_handler_1);
      expect(dispatcher.event_handlers).to.contain(test_handler_2);
      expect(dispatcher.event_handlers).to.contain(test_handler_3);
      expect(dispatcher.event_handlers).to.contain(test_handler_4);
    });

    it('Should remove event handler', () => {
      // Removed event handler, check if proper object returned
      expect(dispatcher.remove_event_handler(event_handler_id_4)).to.deep.equal(
        test_handler_4
      );
      // Make sure it's no longer in dispatcher
      expect(dispatcher.get_event_handler(event_handler_id_4)).to.be.undefined;
    });

    it('Should return false if no event handler found to remove', () => {
      expect(dispatcher.remove_event_handler('NONEXISTING_ID')).to.equal(false);
    });

    it('All event handlers should have unique ID', () => {
      expect(dispatcher.event_handlers.length).to.equal(
        _.uniqBy(dispatcher.event_handlers, handler => handler.instance_id)
          .length
      );
    });

    it('Should return event handler by instance_id', () => {
      expect(dispatcher.get_event_handler(event_handler_id_2)).to.deep.equal(
        test_handler_2
      );
    });

    it('Should enqueue 3 events', () => {
      test_1_event = new Event('test.to_remove_event', test_3_event_data);
      test_2_event = new Event('test.event_1', test_1_event_data);
      test_3_event = new Event('test.event_2', test_2_event_data);

      event_id_1 = dispatcher.enqueue_event(test_1_event);
      event_id_2 = dispatcher.enqueue_event(test_2_event);
      event_id_3 = dispatcher.enqueue_event(test_3_event);

      expect(dispatcher.event_queue_count).to.equal(3);
    });

    it('All events should have have unique ID', () => {
      expect(dispatcher.event_queue.length).to.equal(
        _.uniqBy(dispatcher.event_queue, event => event.queue_id).length
      );
    });

    it('Should shift first event from queue', () => {
      expect(dispatcher.shift_event()).to.deep.equal(test_1_event);
      expect(dispatcher.event_queue_count).to.equal(2);
    });

    it('Should dispatch event with one handler', () => {
      const test_event_data = Math.random();
      return dispatcher
        .dispatch_event(new Event('test.event_1', test_event_data))
        .then(() => {
          // Event handler dispatch should have been called with correct args
          sinon.assert.callCount(test_1_dispatch_cb, 1);
          sinon.assert.calledWith(test_1_dispatch_cb, test_event_data);
          // Make sure this args is same as handler
          sinon.assert.calledOn(test_1_dispatch_cb, test_handler_1);
        });
    });

    it('Should dispatch event and emit event', () => {
      const test_event_data = Math.random();
      const spy_handler = sinon.spy();
      const test_event = new Event('test.event_1', test_event_data);

      dispatcher.on('dispatch', spy_handler);

      return dispatcher.dispatch_event(test_event).then(() => {
        // Event handler dispatch should have been called with correct args
        sinon.assert.callCount(spy_handler, 1);
        sinon.assert.calledWith(spy_handler, test_event, test_handler_1);
      });
    });

    it('Should dispatch event and emit error since no handlers existed', () => {
      const spy_handler = sinon.spy();
      const test_event = new Event('test.NON_EXISTENT_HANDLER', Math.random());

      dispatcher.error_on_unhandled_events = true;

      after(() => {
        dispatcher.error_on_unhandled_events = false;
      });

      dispatcher.on('error', spy_handler);

      return dispatcher.dispatch_event(test_event).then(() => {
        // Event handler dispatch should have been called with correct args
        sinon.assert.callCount(spy_handler, 1);
        let error_thrown = spy_handler.lastCall.args[0];
        expect(error_thrown.message).to.equal(
          `No handlers found for event test.NON_EXISTENT_HANDLER.`
        );
        expect(error_thrown).to.be.instanceof(Error);
      });
    });

    it('Should revert event and emit event', () => {
      const test_event_data = Math.random();
      const spy_handler = sinon.spy();
      const test_event = new Event('test.event_1', test_event_data);

      dispatcher.on('reverted', spy_handler);

      return dispatcher.revert_event(test_event).then(() => {
        // Event handler dispatch should have been called with correct args
        sinon.assert.callCount(spy_handler, 1);
        sinon.assert.calledWith(spy_handler, test_event, test_handler_1);
      });
    });

    it('Should dispatch event with two handlers', () => {
      const test_event_data = Math.random();
      return dispatcher
        .dispatch_event(new Event('test.event_2', test_event_data))
        .then(() => {
          // Event handler dispatch should have been called with correct args
          sinon.assert.callCount(test_2_dispatch_cb, 1);
          sinon.assert.callCount(test_3_dispatch_cb, 1);
          sinon.assert.calledWith(test_2_dispatch_cb, test_event_data);
          sinon.assert.calledWith(test_3_dispatch_cb, test_event_data);
        });
    });

    it('Should dispatch event only for specific handler', () => {
      const test_event_data = Math.random();
      return dispatcher
        .dispatch_event(
          new Event('test.event_2', test_event_data),
          event_handler_id_3
        )
        .then(() => {
          // Event handler dispatch should have been called with correct args
          sinon.assert.callCount(test_2_dispatch_cb, 0);
          sinon.assert.callCount(test_3_dispatch_cb, 1);
          sinon.assert.calledWith(test_3_dispatch_cb, test_event_data);
        });
    });

    it('Should revert event', () => {
      const test_event_data = Math.random();
      return dispatcher
        .revert_event(new Event('test.event_2', test_event_data))
        .then(() => {
          // Only 1 event handler should have been dispatched
          sinon.assert.callCount(test_3_revert_cb, 1);
          // Event handler dispatch should have been called with correct args
          sinon.assert.calledWith(test_3_revert_cb, test_event_data);
          // Only 1 event handler should have been dispatched
          sinon.assert.callCount(test_2_revert_cb, 1);
          // Event handler dispatch should have been called with correct args
          sinon.assert.calledWith(test_2_revert_cb, test_event_data);
          // Make sure this args is same as handler
          sinon.assert.calledOn(test_2_revert_cb, test_handler_2);
        });
    });

    it('Should revert event on specific handler', () => {
      const test_event_data = Math.random();
      return dispatcher
        .revert_event(
          new Event('test.event_2', test_event_data),
          event_handler_id_3
        )
        .then(() => {
          // Only 1 event handler should have been dispatched
          sinon.assert.callCount(test_3_revert_cb, 1);
          sinon.assert.callCount(test_2_revert_cb, 0);
          // Event handler dispatch should have been called with correct args
          sinon.assert.calledWith(test_3_revert_cb, test_event_data);
        });
    });

    it('Should catch and emit error from event handler dispatch', () => {
      const test_event_data = Math.random();
      const spy_thrower = sinon.stub().throws();
      const spy_catcher = sinon.spy();
      test_handler_1.dispatch = spy_thrower;
      dispatcher.on('error', spy_catcher);
      const temp_test_event = new Event('test.event_1', test_event_data);
      return dispatcher.dispatch_event(temp_test_event).then(() => {
        sinon.assert.callCount(spy_thrower, 1);
        sinon.assert.calledWith(spy_thrower, test_event_data);
        sinon.assert.callCount(spy_catcher, 1);
        let error_thrown = spy_catcher.lastCall.args[0];
        expect(error_thrown).to.be.instanceof(EventHandleError);
        expect(error_thrown.event).to.deep.equal(temp_test_event);
        expect(error_thrown.handler).to.deep.equal(test_handler_1);
      });
    });

    it('Should catch and emit error from event handler revert', () => {
      const test_event_data = Math.random();
      const spy_thrower = sinon.stub().throws();
      const spy_catcher = sinon.spy();
      test_handler_1.revert = spy_thrower;
      dispatcher.on('error', spy_catcher);
      const temp_test_event = new Event('test.event_1', test_event_data);
      return dispatcher.revert_event(temp_test_event).then(() => {
        sinon.assert.callCount(spy_thrower, 1);
        sinon.assert.calledWith(spy_thrower, test_event_data);
        sinon.assert.callCount(spy_catcher, 1);
        let error_thrown = spy_catcher.lastCall.args[0];
        expect(error_thrown).to.be.instanceof(EventHandleError);
        expect(error_thrown.event).to.deep.equal(temp_test_event);
        expect(error_thrown.handler).to.deep.equal(test_handler_1);
      });
    });

    it('Should shift and dispatch all events in queue', () => {
      // This test isn't valid if we don't have anything enqueued
      expect(dispatcher.event_queue_count).to.not.equal(0);
      test_handler_1.dispatch = test_1_dispatch_cb;
      test_handler_2.dispatch = test_2_dispatch_cb;
      return dispatcher.run().then(() => {
        expect(dispatcher.event_queue_count).to.equal(0);
        sinon.assert.callCount(test_1_dispatch_cb, 1);
        sinon.assert.calledWith(test_1_dispatch_cb, test_2_event.data);
        sinon.assert.callCount(test_2_dispatch_cb, 1);
        sinon.assert.calledWith(test_2_dispatch_cb, test_3_event.data);
      });
    });

    it('Should enqueue an event while being dispatched', () => {

      dispatcher.event_queue = [];

      const test_event_data = Math.random();
      test_event_a = new Event('test.event_2', test_event_data);

      test_handler_1.dispatch = function() {
        this.emit('enqueue_event', test_event_a);
      };

      test_handler_1.dispatch.apply(test_handler_1);

      expect(dispatcher.shift_event()).to.deep.equal(test_event_a);
    });

    it('Should enqueue an EventComplete when dispatching an event', () => {

      dispatcher.event_queue = [];

      const test_event_data = Math.random();
      const test_event_data_return = Math.random();
      test_event_a = new Event('test.event_1', test_event_data);

      test_handler_1.dispatch = () => test_event_data_return;

      test_handler_1.enqueue_complete_event = true;

      dispatcher.enqueue_event(test_event_a);

      return dispatcher.run().then(() => {
        const event_remaining = dispatcher.shift_event();
        expect(event_remaining).to.be.instanceof(EventComplete);
        expect(event_remaining.event_name).to.equal('test.event_1.complete');
        expect(event_remaining.data).to.equal(test_event_data_return);
        return dispatcher.run().then(() => {
          // When dispatching the complete event, should not enqueue another event
          expect(dispatcher.shift_event()).to.be.undefined;
        });
      })
    });

    describe('should_handle', () => {
      const test_event_name = 'test_event_2_b';
      const test_handles = [
        new test_1_handler_class(),
        new test_1_handler_class(),
        new test_1_handler_class(),
      ];
      test_handles.forEach(handler => {
        handler.should_handle = sinon.stub();
        handler.dispatch = sinon.stub();
        handler.event_name = test_event_name;
        dispatcher.load_event_handler(handler);
      });
      beforeEach(() => {
        test_handles.forEach(handler => {
          handler.should_handle.reset();
          handler.dispatch.reset();
        });
      });
      it('Should call should_handle with event object', () => {
        const test_event = new Event(test_event_name, Math.random());
        return dispatcher.dispatch_event(test_event).then(() => {
          test_handles.forEach(handler => {
            sinon.assert.calledWith(handler.should_handle, test_event);
          });
        });
      });
      it('Should handle all if should_handle returns true', () => {
        test_handles.forEach(handler => {
          handler.should_handle.returns(true);
        });
        const test_event = new Event(test_event_name, Math.random());
        return dispatcher.dispatch_event(test_event).then(() => {
          test_handles.forEach(handler => {
            sinon.assert.calledWith(handler.dispatch, test_event.data);
          });
        });
      });
      it('Should not handle any if should_handle returns false', () => {
        test_handles.forEach(handler => {
          handler.should_handle.returns(false);
        });
        const test_event = new Event(test_event_name, Math.random());
        return dispatcher.dispatch_event(test_event).then(() => {
          test_handles.forEach(handler => {
            sinon.assert.notCalled(handler.dispatch);
          });
        });
      });
      it('Should handle with one handler', () => {
        test_handles.forEach(handler => {
          handler.should_handle.returns(false);
        });
        test_handles[1].should_handle.returns(true);

        const test_event = new Event(test_event_name, Math.random());
        return dispatcher.dispatch_event(test_event).then(() => {
          sinon.assert.calledWith(test_handles[1].dispatch, test_event.data);
          sinon.assert.notCalled(test_handles[0].dispatch);
          sinon.assert.notCalled(test_handles[2].dispatch);
        });
      });
    });

    describe('defer_dispatch', () => {
      const test_event_name = 'test_event_2_c';
      const test_defer_event_name = 'test_defer'
      const test_handles = [
        new test_1_handler_class(),
        new test_1_handler_class(),
        new test_1_handler_class(),
      ];
      test_handles.forEach(handler => {
        handler.defer_dispatch = {
          event_name: test_defer_event_name,
          check_callback: sinon.stub().returns(true),
        }
        handler.event_name = test_event_name;
        handler.dispatch = sinon.stub();
        dispatcher.load_event_handler(handler);
      });
      beforeEach(() => {
        test_handles.forEach(handler => {
          handler.defer_dispatch.check_callback.reset();
          handler.defer_dispatch.check_callback.returns(true);
          handler.dispatch.reset();
        });
      });

      it('Should dispatch only after defer_dispatch resolves', () => {
        const mock_dispatch_data = Math.random();
        const mock_event_data = Math.random();

        const promise = dispatcher.dispatch_event(new Event(test_event_name, mock_dispatch_data));

        return Promise.resolve()
          .then(() => {
            // Shouldn't be dispatched yet
            test_handles.forEach(handler => {
              sinon.assert.notCalled(handler.dispatch);
              sinon.assert.notCalled(handler.defer_dispatch.check_callback);
            });
            return immmediatePromise();
          })
          .then(() => {
            // Triggering this event will allow defer_dispatch.check_callback to be checked
            dispatcher.emit(test_defer_event_name, mock_event_data);
            return immmediatePromise();
          })
          .then(() => {
            // Should now be dispatched
            test_handles.forEach(handler => {
              sinon.assert.calledWith(handler.dispatch, mock_dispatch_data);
              sinon.assert.calledWith(handler.defer_dispatch.check_callback, mock_event_data);
            });

            return promise;
          });
      });

      it('Should dispatch 2 events at first, and then the last momentarily after', () => {
        const mock_dispatch_data = Math.random();
        const mock_event_data = Math.random();

        const promise = dispatcher.dispatch_event(new Event(test_event_name, mock_dispatch_data));

        test_handles[0].defer_dispatch.check_callback.returns(false);

        return Promise.resolve()
          .then(() => {
            // Shouldn't be dispatched yet
            test_handles.forEach(handler => {
              sinon.assert.notCalled(handler.dispatch);
              sinon.assert.notCalled(handler.defer_dispatch.check_callback);
            });
            return immmediatePromise();
          })
          .then(() => {
            // Triggering this event will allow defer_dispatch.check_callback to be checked
            dispatcher.emit(test_defer_event_name, mock_event_data);
            return immmediatePromise();
          })
          .then(() => {
            // Last two should be dispatched, but not 0
            sinon.assert.notCalled(test_handles[0].dispatch);
            sinon.assert.calledWith(test_handles[1].dispatch, mock_dispatch_data);
            sinon.assert.calledWith(test_handles[2].dispatch, mock_dispatch_data);
            // But all check_callbacks should have been called
            test_handles.forEach(handler => {
              sinon.assert.calledWith(handler.defer_dispatch.check_callback, mock_event_data);
            });
            return immmediatePromise();
          })
          .then(() => {
            // Triggering this event will allow defer_dispatch.check_callback to be checked
            test_handles[0].defer_dispatch.check_callback.returns(true);
            dispatcher.emit(test_defer_event_name, mock_event_data);
            return immmediatePromise();
          })
          .then(() => {
            // Now all should now be dispatched
            test_handles.forEach(handler => {
              sinon.assert.calledWith(handler.dispatch, mock_dispatch_data);
              sinon.assert.calledWith(handler.defer_dispatch.check_callback, mock_event_data);
            });

            return promise;
          });
      });

      it('Should emit error if defer_dispatch.check_callback throws error', () => {
        const mock_dispatch_data = Math.random();
        const mock_event_data = Math.random();
        const mock_error = new Error('Defer check fail ' + Math.random());
        const emit_error_spy = sinon.spy();
        const mock_event = new Event(test_event_name, mock_dispatch_data);
        dispatcher.on('error', emit_error_spy);
        test_handles[0].defer_dispatch.check_callback.throws(mock_error);

        const promise = dispatcher.dispatch_event(mock_event);

        return Promise.resolve()
          .then(() => {
            // Shouldn't be dispatched yet
            test_handles.forEach(handler => {
              sinon.assert.notCalled(handler.dispatch);
              sinon.assert.notCalled(handler.defer_dispatch.check_callback);
            });
            return immmediatePromise();
          })
          .then(() => {
            // Triggering this event will allow defer_dispatch.check_callback to be checked
            dispatcher.emit(test_defer_event_name, mock_event_data);
            return immmediatePromise();
          })
          .then(() => {
            sinon.assert.called(emit_error_spy);
            let error_thrown = emit_error_spy.lastCall.args[0];
            expect(error_thrown).to.be.instanceof(EventHandleError);
            expect(error_thrown.culprit).to.equal(mock_error);
            expect(error_thrown.handler).to.equal(test_handles[0]);
            expect(error_thrown.event).to.equal(mock_event);
          });
      });
    });
  });

  it('Should never call console.log', () => {
    sinon.assert.neverCalledWith(console_log_spy);
  });
});
