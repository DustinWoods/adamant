//Main app goes here
//Some code action is happening over in /test/



/* THE FOLLOWING IS TESTING CODE FOR DATA COLLECTOR SERVICE */

var plugin_loader = require('./include/plugin-loader'),
	_config = require('./include/config.js'),
	mongoose_util = require('./include/mongoose-utilities'),
	_ = require('lodash'),
	sprintf = require('sprintf-js').sprintf;

var plugins = plugin_loader.loadPlugins(_config);


var collector_configs = [
	{
		plugin_name: 'Toggl',
		collection_name: 'toggl_timeEntry',
		version: '1.0',
		config: {
			apiToken:'771a871d9670b874655a25e20391640f'
		}
	},
	{
		plugin_name: 'TimeClock',
		collection_name: 'timeclock_timeEntry',
		version: '1.0',
		config: {
			days_back_to_sync: 1,
			url:'http://192.168.1.29/',
			user:'admin',
			password:'FVnZaHD8HyCe'
		}
	}
];


function main() {

	var collect_services = _.map(collector_configs, (i) => {
		try {

			var service = plugin_loader.initializeCollectorService(plugins, i);
			service.on('error',		(e) => console.log('Error in service: ' + e));
			service.on('started',	() => console.log('Service started.'));
			service.on('stopped',	() => console.log('Service stopped.'));
			service.start();

		} catch (e) {
			console.log(e);			
		}
	});

}

//Connect to db, then do main
mongoose_util.connect(_config.mongodb.uri).then(main);