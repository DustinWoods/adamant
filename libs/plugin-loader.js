var Plugin = require('./plugin'),
  _ = require('lodash'),
  path = require('path');

class PluginLoader {
  /**
   * Creates a new PluginLoader object.
   * A PluginLoader loads plugin files into memory, and provide factory for creating instances of plugin components.
   *
   *
   * @memberOf PluginLoader
   */
  constructor() {
    this.plugins = [];
  }

  /**
   * Loads a plugin into memeory.
   *
   * @param {String} path - Path to plugin directory to be loaded
   * @param {Object} config - Configuration to pass to plugin on load
   *
   */
  load_plugin(module_name, _config) {
    //Load in the plugin
    let plugin_args = require(module_name);

    //Could not load it, or it's not a valid plugin_args
    if (typeof plugin_args !== 'object')
      throw new Error(
        `Error loading plugin: ${module_name} - Invalid index.js contents.`
      );

    // Get some module info
    let plugin_info = PluginLoader.get_module_info(module_name);

    // Plugin name is now the same as module
    plugin_args.name = plugin_info.name;
    plugin_args.version = plugin_info.version;

    // These aren't required
    plugin_args.description = plugin_info.description
      ? plugin_info.description
      : '';
    plugin_args.author = plugin_info.author ? plugin_info.author : '';
    plugin_args.license = plugin_info.license ? plugin_info.license : '';

    //Initialize plugin
    const plugin = new Plugin(plugin_args);

    //If all went well loading it...
    plugin.enabled = true;

    plugin.on_load(_config);

    //Add plugin to array
    this.plugins.push(plugin);

    return plugin;
  }


  /**
   * After plugins are loaded into memeory, a collector service can be initialized.
   *
   * @param {any} collector_config - Configuration used for initializing collector instance
   * @returns {Collector}
   */
  create_collector(collector_config) {
    return this.get_plugin_by_name(
      collector_config.plugin_name
    ).create_component(
      'collectors',
      collector_config.collector_name,
      collector_config.config,
      collector_config.version
    );
  }

  /**
   * Creates an event handler instance. First looks up plugin, then event handler class by name
   *
   * @param {object} handler_config
   * @returns {EventHandler}
   *
   * @memberOf PluginLoader
   */
  create_event_handler(handler_config) {
    return this.get_plugin_by_name(handler_config.plugin_name).create_component(
      'event_handlers',
      handler_config.handler_name,
      handler_config.config,
      handler_config.version
    );
  }

  /**
   * Looks up plugin by plugin name, returns plugin instance
   *
   * @param {String} plugin_name - Name of plugin, same name in package.json file
   * @param {boolean} [exclude_disabled=true] - If true, disabled plugins will not be searched through
   * @returns
   * @memberof PluginLoader
   */
  get_plugin_by_name(plugin_name, exclude_disabled = true) {
    // Find plugin
    const find = { name: plugin_name };
    if (exclude_disabled) {
      find.enabled = true;
    }
    const plugin = _.find(this.plugins, find);
    if (!plugin) throw new Error(`Plugin not loaded: ${plugin_name}`);
    return plugin;
  }

  /**
   * Loops through plugins and loads models
   *
   * @memberof PluginLoader
   */
  load_plugin_models(mongoose) {
    // Look at each plugin
    _.each(this.plugins, plugin => {
      // Look at each model
      _.each(plugin.models, model_config => {

        model_config.schema = mongoose.Schema(model_config.schema);

        // Allow schema_callback to provide plugin options, middleware stuff
        if (typeof model_config.schema_callback === 'function') {
          model_config.schema_callback(model_config.schema);
        }

        model_config.model = mongoose.model(model_config.name, schema);

        return model_config.model;

      });
    });
  }

  /**
   * Loops through plugins and intializes express routes
   *
   * @memberof PluginLoader
   */
  load_plugin_routes(express) {
    // Look at each plugin
    _.each(this.plugins, plugin => plugin.load_routes(express));
  }

  /**
   * Loops through plugins and intializes sockets io events
   *
   * @memberof PluginLoader
   */
  load_plugin_sockets(socket) {
    // Look at each plugin
    _.each(this.plugins, plugin => plugin.map_events(socket));
  }

  /**
   * Returns package.json contents for local module
   *
   * @static
   * @param {String} module_name
   * @returns {Object} - Contents of package file
   *
   * @memberOf PluginLoader
   */
  static get_module_info(module_name) {
    let module_path = require.resolve(module_name);
    module_path = path.dirname(module_path);

    let pkg_path = path.join(module_path, 'package.json');

    let pkg_contents = require(pkg_path);

    return pkg_contents;
  }
}

module.exports = PluginLoader;
