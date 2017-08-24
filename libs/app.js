const PluginLoader = require('./plugin-loader'),
  mongoose_util = require('./mongoose-utilities'),
  _ = require('lodash'),
  LoopService = require('./loop-service'),
  EventDispatcher = require('./event-dispatcher'),
  EventHandler = require('./event-handler'),
  Event = require('./event'),
  chalk = require('chalk'),
  express = require('express')(),
  server = require('http').createServer(express),
  io = require('socket.io')(server);

/**
 * A singleton class
 *
 * @class App
 */
class App {
  constructor(config) {
    this._config = config;
    this.plugin_loader = new PluginLoader();
    this.collect_services = [];

    // Set up event dispatcher loop service
    this.event_dispatcher = new EventDispatcher();
    this.event_dispatcher_service = new LoopService(
      this.event_dispatcher.run.bind(this.event_dispatcher)
    );
    this.event_dispatcher_service.name = 'Event dispatcher';
    this.event_dispatcher.on('error', console.log);
    this._bind_service_events(this.event_dispatcher_service);
  }

  /**
   * Runs app initialize functions
   *
   * @returns
   * @memberof App
   */
  init() {
    return Promise.resolve()
    .then(mongoose_util.mongoose.connect.bind(mongoose_util.mongoose,this._config.mongodb.uri))
    .then(this.plugin_loader.load_plugin_models.bind(this.plugin_loader, mongoose_util))
    .then(this._load_routes.bind(this))
    .then(this._bind_socket_events.bind(this));
  }

  /**
   * Loads express endpoints for app and plugins
   *
   * @memberof App
   */
  _load_routes() {

    // Default endpoints
    express.get('/', (req, res) => {
      res.send('Metric platform!');
    });

    this.plugin_loader.load_plugin_routes(express);
  }

  /**
   * Binds socket events for app and plugins
   *
   * @memberof App
   */
  _bind_socket_events() {
    io.on('connection', socket => {

      socket.on('disconnect', () => {
        // @todo - perform disconnect routine here
      });

      this.plugin_loader.load_plugin_sockets(socket);
    });
  }

  /**
   * Loads plugins
   *
   * @param {Array} plugin_dirs - Array of plugin names to be required
   *
   * @memberOf App
   */
  load_plugins(plugin_dirs) {
    _.forEach(plugin_dirs, plugin_path => {
      this.plugin_loader.load_plugin(plugin_path, this._config);
    });
  }

  /**
   * Loads a collector from config, creates a service
   *
   * @param {object} config
   *
   * @memberOf App
   */
  load_collector(config) {
    const collector = this.plugin_loader.create_collector(config);
    collector.setMongoose(mongoose_util.mongoose);
    const service = new LoopService(collector.run.bind(collector));

    if (config.service_retry_max_attempts)
      service.retry_max_attempts = config.service_retry_max_attempts;

    if (config.service_retry_time_between)
      service.retry_time_between = config.service_retry_time_between;

    if (config.run_min_time_between)
      service.run_min_time_between = config.run_min_time_between;

    service.name = `${collector.model_name} collector`;
    this._bind_service_events(service);
    this._bind_model_events(collector);
    service.on('complete', () =>
      this.event_dispatcher.emit(`complete.${collector.model_name}`)
    );
    this.collect_services.push(service);
  }

  /**
   * Loads an event handler instance into event dispatcher
   *
   * @param {object} config
   *
   * @memberOf App
   */
  load_event_handler(config) {
    const handler = this.plugin_loader.create_event_handler(config);
    this.event_dispatcher.load_event_handler(handler);
  }

  /**
   * Binds model data events in collector to event dispatcher queue
   *
   *  @param {Collector} collector
   *
   * @memberOf App
   */
  _bind_model_events(collector) {
    //Add event handling
    _.each(['create', 'update', 'remove'], event => {
      collector.on(event, data => {
        this.event_dispatcher.enqueue_event(
          new Event(`${collector.model_name}.${event}`, data)
        );
      });
    });

    collector.on('error', err => {
      console.log(`${chalk.red('error')}: ${chalk.grey(err.stack)}`);
    });
  }

  /**
   * Temporary way to handle service events
   *
   * @param {LoopService} service
   *
   * @memberOf App
   */
  _bind_service_events(service) {
    service.on('error', e => {
      console.log(
        `${chalk.bgCyan(service.name)} service ${chalk.red(
          'error'
        )}: ${chalk.grey(e.stack)}`
      );
      if (e.culprit) {
        console.log(`${chalk.red('error details')}: ${chalk.grey(e.culprit)}`);
      }
    });
    service.on('start', () =>
      console.log(
        `${chalk.bgCyan(service.name)} service ${chalk.bold('started')}.`
      )
    );
    service.on('stop', () =>
      console.log(
        `${chalk.bgCyan(service.name)} service ${chalk.bold('stopped')}.`
      )
    );
  }

  /**
   * Starts loop services and event dispatcher.
   *
   * @memberof App
   */
  run() {

    // graceful shutdown
    process.on('SIGTERM', this.stop.bind(this));

    this.event_dispatcher_service.start().catch(console.log);
    _.each(this.collect_services, service =>
      service.start().catch(console.log)
    );
    this.server.listen(this._config.web.port);
  }

  stop() {
    // halt web server
    this.server.close();

    // stop collector services
    _.each(this.collect_services, service =>
      service.stop().catch(console.log)
    );

    // stop event dispatcher service
    this.event_dispatcher_service.stop().catch(console.log);

    // terminate app process
    process.exit(0);
  }
}

module.exports = App;
