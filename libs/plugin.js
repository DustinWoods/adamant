var _ = require('lodash'),
  semver = require('semver');

class Plugin {
  /**
	 * Creates an instance of Plugin.
	 *
	 * @param {object} args
	 *
	 * @memberOf Plugin
	 */
  constructor(config) {
    config = _.isUndefined(config) ? {} : config;

    //Default object properties
    const defaults = {
      collectors: [],
      event_handlers: [],
      models: [],
      enabled: false,
      name: '',
      version: '',
      description: '',
      author: '',
      license: '',
    };

    if (!config.hasOwnProperty('name'))
      throw new Error(`A valid name is required for Plugin object.`);

    // Merge config and assign properties to this
    Object.assign(this, defaults, config);
  }

  /**
   * Allows extending model schema before model is loaded
   *
   * @param {String} plugin_name
   * @param {String} model_name
   * @param {Object} schema
   * @memberof PluginLoader
   */
  extend_schema(model_name, extend_schema) {
    const model_config = _.find(this.models, {name: model_name});
    const extend_path_keys = _.keys(extend_schema);
    const existing_path_keys = _.union(_.keys(model_config.schema), ['_id']);
    const not_allowed_keys = _.intersection(extend_path_keys, existing_path_keys);
    if(not_allowed_keys.length) {
      throw new Error(`Cannot extend ${model_name} because path(s) cannot be overwritten: ${not_allowed_keys.join(', ')}`);
    }
    // Save a copy of original schema
    if(_.isUndefined(model_config._original_schema)) {
      model_config._original_schema = Object.assign({}, model_config.schema);
    }
    model_config.schema = Object.assign({}, model_config.schema, extend_schema);
  }

  /**
	 * Abstract way to create a component from a plugin
	 *
	 * @param {any} type collectors, event_handlers
	 * @param {any} class_name Name of class of componenet to look for and construct
	 * @param {any} args Passed to constructor of component
	 * @returns
	 *
	 * @memberOf Plugin
	 */
  create_component(type, class_name, args, require_version = '') {
    let component, component_class;

    // Check if type exists in plugin
    if (typeof this[type] !== 'object')
      throw new Error(`${this.name} does not have component of type: ${type}.`);

    // Find component in plugin
    component_class = _.find(this[type], { name: class_name });
    if (!component_class) throw new Error(`Component not found: ${class_name}`);

    // Create component instance
    component = new component_class(args);

    // Check version
    if (require_version && !semver.satisfies(this.version, require_version)) {
      throw new Error(
        `Version requirements not met. Plugin version: ${this
          .version} Semver requirement: ${require_version}.`
      );
    }

    return component;
  }

  // default methods to be overridden
  load_routes() {}

  map_events() {}

  on_load() {}

  on_unload() {}
}

module.exports = Plugin;
