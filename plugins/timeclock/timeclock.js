//******HELPER FUNCTIONS FOR GETTING DATA*********//

//Currently this is a static library in that you cannot login as mutliple users.

//need to use cookies for logging in
let request = require('request'),
  cjar = request.jar(),
  cheerio = require('cheerio'),
  moment = require('moment');

request = request.defaults({jar: cjar});

//logs into mavenlink using non-api methods
function do_login(url,username,password) {

  const loginPage = `${url}/login.html`;

  loginFormData = [];
  loginFormData.username = username;
  loginFormData.password = password;
  loginFormData.buttonClicked = 'Submit';

  return new Promise((resolve,reject) => {
    request.post({url:loginPage,form:loginFormData},(err,res,body) => {
      //If we were successful, then we should get a redirect
      if(res && res.statusCode == '301') {
        //success login!
        resolve();
      } else {
        //determine error message
        let error_message = '';
        if(err) {
          error_message = err;
        } else if(res.statusCode == '301') {
          error_message = 'Double check username and password.';
        } else if(!res) {
          error_message = 'No data was returned from request.';
        }
        reject(`Could not log into time clock: ${error_message}`);
      }
    });
  });
}

//Gets HTML content of report from timeclock
function get_report_html(url,start_date,end_date) {

  url += '/report.html';

  data = [];
  data.rt = '1';
  data.type = '7';
  data.from = start_date.format('MM/DD/YY');
  data.to = end_date.format('MM/DD/YY');
  data.eid = '0';

  return new Promise((resolve,reject) => {
    request.get({url:url,qs:data},(err,response,body) => {
      if(err || !body) {
        reject(`Could not get timeclock report. Maybe reboot timeclock? ${err}`);
      } else if(response.statusCode == '301') {
        reject('Could not get timeclock report. User session probably timed out.');
      } else {
        resolve(body);
      }
    });
  });
}

//Tries to parse a float
function try_parse_float(val) {
  try {
    return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
  } catch(ex) {
    return 0;
  }
}

//Parses html report and returns array of data
function* parse_report(html) {
  const $ = cheerio.load(html);

  let current_date_str;

  //This is where we define how fields are parsed in the report
  const parse_fields = [
    {
      selector: '.punchEmployee > a',
      name: 'employeeId',
      parse_function: (input) => {
        return input.match(/([0-9]+)\-(.*)/)[1];
      }
    },
    {
      selector: '.punchEmployee > a',
      name: 'employeeName',
      parse_function: (input) => {
        return input.match(/([0-9]+)\-(.*)/)[2];
      }
    },
    {
      selector: 'a.punchIn .punchTime',
      name: 'punchInTime',
      parse_function: (input) => {
        if(input == 'Add Punch' || !input || typeof current_date_str === 'undefined') return;
        input = input.replace(/^(.*)([a|p])$/,'$1 $2m');
        return moment(new Date(current_date_str + ' ' + input)).format('YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      selector: 'a.punchIn .punchFlags',
      name: 'punchInFlags'
    },
    {
      selector: 'a.punchIn .punchDepartment',
      name: 'punchInDepartment'
    },
    {
      selector: 'a.punchOut .punchFlags',
      name: 'punchOutFlags'
    },
    {
      selector: 'a.punchOut .punchTime',
      name: 'punchOutTime',
      parse_function: (input) => {
        if(input == 'Add Punch' || !input || typeof current_date_str === 'undefined') return;
        input = input.replace(/^(.*)([a|p])$/,'$1 $2m');
        return moment(new Date(current_date_str + ' ' + input)).format('YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      selector: 'a.punchOut .punchLunch',
      name: 'punchOutLunch',
      parse_function: (input) => {
        return try_parse_float(input)/60; //lunch is in minutes
      }
    },
    {
      selector: 'a.punchOut .punchADJ',
      name: 'punchOutADJ',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchSTD',
      name: 'punchSTD',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchOT1',
      name: 'punchOT1',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchOT2',
      name: 'punchOT2',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchHOL',
      name: 'punchHOL',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchHRS',
      name: 'punchHRS',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchLaborDS',
      name: 'punchLaborDS',
      parse_function: (input) => {
        input = input.replace('$','');
        return try_parse_float(input);
      }
    },
    {
      selector: '.punchLabor',
      name: 'punchLabor',
      parse_function: (input) => {
        return try_parse_float(input);
      }
    },
  ];


  //Get all time entry rows and date rows
  const entries = $('#pageContents > .noAccrual, #pageContents > .clear');

  let data = [];

  for (let j = entries.length - 1; j >= 0; j--) {

    //This is a row giving us the current_date_str, and that is all
    if($(entries[j]).attr('class') == 'clear') {
      current_date_str = $(entries[j]).text().trim();
      continue;
    }

    let punch_id = $('.punchIn', entries[j]).attr('href');
    if(typeof punch_id === 'undefined') {
      continue;
    }
    punch_id = punch_id.match(/pid=([0-9]+)/)[1];

    const data_row = {};

    data_row.pid = punch_id;

    //Loop through fields to parse
    for (let i in parse_fields) {
      data_row[parse_fields[i].name] = '';

      const dom_find = $(parse_fields[i].selector, entries[j]);

      let val = '';

      if(dom_find.length != 1) {
        val = '';
      } else {
        val = dom_find.text().trim();
      }

      if(typeof parse_fields[i].parse_function !== 'undefined') {
        try {
          val = parse_fields[i].parse_function(val);
        } catch(ex) {
          val = '';
        }
      }

      data_row[parse_fields[i].name] = val;
    }

    yield data_row;
  }
}

//Export them functions
module.exports = {
  do_login: do_login,
  get_report_html: get_report_html,
  parse_report: parse_report
};
