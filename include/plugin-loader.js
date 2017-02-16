var fs = require('fs'),
    path = require('path'),
    Plugin = require('./plugin'),
	semver = require('semver'),
	_ = require('lodash'),
	Collector = require('./collector'),
    LoopService = require('./loop-service'),
    sprintf = require('sprintf-js').sprintf,
    mongoose = require('./mongoose-utilities').mongoose,
    utilities = require('./utilities'),
    EventEmitter = require('events');

/**
 * Creates a new PluginLoader object. 
 * A PluginLoader loads plugin files into memeory and provides a way to bind with plugin events.
 * 
 * @param {Array} _config - Configuration array that is passed to every plugin constructor.
 * 
 * @todo Constructor shouldn't load plugins
 */
var PluginLoader = function(_config) {

	//Scope it
	var self = this;

	//We'll export these
	self.plugins = [];

	//Get directors of plugins
	var plugin_dirs = utilities.getPluginsDirectories();

	//Loop through them
	for (var i in plugin_dirs) {

		//Load in the plugin
		var plugin_args = require('../' + plugin_dirs[i].path);

		//Could not load it, or it's not a valid plugin_args
		if(typeof plugin_args !== 'function') {
			continue;
		}

		//Initialize plugin_args
		plugin_args = plugin_args(_config);

		//Initialize plugin
		var plugin = new Plugin(plugin_args);

		//If plugin wasn't given a name, name it after the directory
		plugin.name = plugin.name ? plugin.name : plugin_dirs[i].name;

		//If all went well loading it...
		plugin.enabled = true;

		//Add plugin to registered array
		self.plugins.push(plugin);
	}


	/**
	 * Loads a plugin into memeory.
	 * 
	 * @param {String} path - Path to plugin directory to be loaded
	 * @param {Object} config - Configuration to pass to plugin on load
	 * 
	 * @todo Implement this, remove constructor code that loads plugins
	 */
	self.load_plugin = function(path, config) {

	}

	/**
	 * After plugins are loaded into memeory, a collector service can be initialized.
	 * 
	 * @param {any} collector_config - Configuration used for initializing collector instance
	 * @returns {LoopService} to interface with collector (start, stopm etc...)
	 */
	self.initialize_collector_service = function(collector_config) {

		//Find plugin
		var plugin = _.find(self.plugins, {name: collector_config.plugin_name, enabled: true});
		if(!plugin) throw new Error(sprintf("Plugin not loaded: %s", collector_config.plugin_name));

		//Find data collector in plugin
		var collector = _.find(plugin.collectors, {model_name: collector_config.model_name})
		if(!collector) throw new Error(sprintf("Collection not found: %s", collector_config.model_name));

		//Check version
		if(collector.version && collector.version !== collector_config.version) {
			/** 
			 * @todo Do better version check, and also maybe run update on current config
			 */
			throw new Error("Collection version not the same.");
		}

		//Create data colector instance
		try {
			collector = new Collector(collector, collector_config.config);
		} catch (e) {
			throw new Error(sprintf("Error creating data collector instance: %s", e));
		}

		//Add event handling
		_.each(['create','update','remove'], (event) => {
			collector.on(event, (data) => self.handle_event_emit(collector.model_name, event, data));
		});

		return new LoopService(collector.run.bind(collector), collector.stop.bind(collector));
	}

	/**
	 * A generic event handler for dispatching collector events.
	 * 
	 * @param {String} model_name - Name of mongoose model associated with event
	 * @param {String} event - Name/scope of event to trigger
	 * @param {any} data - Data to pass to event handlers
	 */
	self.handle_event_emit = function(model_name, event, data) {
		
		self.emit(event, model_name, data);
		self.emit(model_name + '_' + event, data);
	}
}

PluginLoader.prototype.__proto__ = EventEmitter.prototype;

module.exports = PluginLoader;