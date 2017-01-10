$('.fl-email-registration').each(function(){
  //customization

  var $email_validation = $(this);
  var widgetId = $email_validation.data('email-registration-id');
  var data = Fliplet.Widget.getData(widgetId) || {};

  var CODE_VALID = 1440,
      CODE_LENGTH = 6,
      ORG_NAME = Fliplet.Env.get('organizationName'),
      APP_NAME = Fliplet.Env.get('appName'),
      APP_VALIDATION_DATA_DIRECTORY_ID = data.dataSource,
      DATA_DIRECTORY_COLUMN = data.emailColumn,
      DATA_DIRECTORY_CHECK_COLUMN = data.otherColumn,
      CONTACT_UNREACHABLE = "We couldn't reach this contact. Try again or change your networking method.";

  function initEmailValidation() {
    Fliplet.Security.Storage.init().then(function(){

      attachEventListeners();
      setUserDataPV(function () {
        //check the validation current state.
        if (userDataPV.code !== "" && userDataPV.code_generated_at > Date.now() - (CODE_VALID * 60 * 1000)) {
          $email_validation.find('.have-code').removeClass('hidden').addClass('show');
          calculateElHeight($email_validation.find('.state[data-state=auth]'));
        }
      }, function () {
      });
    });

  }
  // VARS
  var havePinCode = true;

  function readDataSource(data_source_id, where_object, check_column, success_callback, fail_callback) {
    //read_data_sources -> OK.

    Fliplet.DataSources.connect(data_source_id).then(function(dataSource){
      return dataSource.find({
        where: where_object
      });
    }).then(function(entries){
      if(entries.length) {
        entries.forEach(function(entry) {
          if ( entry.data[check_column] === null || entry.data[check_column] === "" ) {
            success_callback(entry);
            return;
          } else {
            fail_callback(false);
            return;
          }
        });
      } else {
        fail_callback(true);
      }
    }, function() {
      fail_callback(true);
    });
  }

  function sendEmail(body, replyTo, subject, to, success_callback, fail_callback) {

    var options = {
      "to": [{
        "email": to,
        "name": "",
        "type": "to"
      }],
      "html": body,
      "subject": subject
    };

    Fliplet.Communicate.sendEmail(options).then(success_callback, fail_callback);

  }

  /**
   * @param contact user contact to send the notification
   * @param success_callback on success function
   * @param fail_callback on fail function
   */
  function sendNotification(contact, success_callback, fail_callback) {

    // Let's update the PV with this new data
    userDataPV.code = rDigits(CODE_LENGTH);
    userDataPV.code_generated_at = Date.now();
    Fliplet.Security.Storage.update().then(function(){
      var body = generateVerifyBody();

      sendEmail(body, contact, APP_NAME, contact, success_callback, fail_callback);
    });
  }

  function generateVerifyBody() {
    var body;
    var string = $("#email-template-holder").html();
    var template = Handlebars.compile(string);
    body = template({
      code: userDataPV.code,
      time: moment().format('MMM Do YY, h:mm:ss a'),
      app_name: APP_NAME,
      org_name: ORG_NAME,
      code_duration: (CODE_VALID / 60);
    });

    return body;
  }

// Generate a random numeric code
  function rDigits(length) {
    var r = Math.random().toString().slice(2, length + 2);
    return r.length === length ? r : rDigits(length);
  }

  function attachEventListeners() {

    // Network states
    document.addEventListener("offline", function(){
      $('#offline-notification').addClass('show');
      $('body').addClass('device-offline');
    }, false);

    document.addEventListener("online", function(){
      setTimeout(function() {
        if(Fliplet.Navigator.isOnline()){
          if ($('#offline-notification').hasClass('show')) {
            $('#offline-notification').removeClass('show');
          }

          if ($('body').hasClass('device-offline')){
            $('body').removeClass('device-offline');
          }

          if ($('#offline-screen').hasClass('show')) {
            $('#offline-screen').removeClass('show');
          }
          return;
        }
        $('body').addClass('device-offline');
        $('#offline-notification').addClass('show');
      },100);
    }, false);


    calculateElHeight($email_validation.find('.state[data-state=auth]'));
    $email_validation.find('.verify-identity').on('click', function (event) {
      var _this = $(this);
      _this.html("Registering");
      _this.addClass("disabled").prop('disabled', true);

      window.emailAddress = $('input[name=verify-email]').val().toLowerCase(); // GET EMAIL VALUE

      $email_validation.find('.email-error').removeClass('show');
      // EMAIL FOUND ON DATA SOURCE
      if ($email_validation.find('.state[data-state=auth] .form-group').hasClass('has-error')) {
        $email_validation.find('.state[data-state=auth] .form-group').removeClass('has-error');
      }
      calculateElHeight($('.state[data-state=verify-code]'));
      // VALID EMAIL
      if (validateEmail(emailAddress)) {
        // CHECK FOR EMAIL ON DATA SOURCE

        function greatSuccess(entry) {
          userDataPV.entry = entry;
          userDataPV.email = emailAddress;

          // EMAIL FOUND ON DATA SOURCE
          if ($email_validation.find('.state[data-state=auth] .form-group').hasClass('has-error')) {
            $email_validation.find('.state[data-state=auth] .form-group').removeClass('has-error');
          }
          sendNotification(emailAddress, function () {
            // TRANSITION
            $email_validation.find('.state.present').removeClass('present').addClass('past');

            $email_validation.find('.input-email').text(emailAddress); // UPDATES TEXT WITH EMAIL
            _this.html("Register");
            _this.removeClass("disabled").prop('disabled', false);

            calculateElHeight($email_validation.find('.state[data-state=verify-code]'));
            $email_validation.find('.state[data-state=verify-code]').removeClass('future').addClass('present');
          }, function () {
            $email_validation.find('.email-error').text(CONTACT_UNREACHABLE).addClass("show");
          });
        }

        readDataSource(APP_VALIDATION_DATA_DIRECTORY_ID, '{"' + DATA_DIRECTORY_COLUMN+'":' + '"' + emailAddress + '"}', DATA_DIRECTORY_CHECK_COLUMN, greatSuccess, function ( error ) {
          if ( error ) {
            // Check if it has a valid domains
            if (data.domains && data.domains.length) {
              var emailDomain = emailAddress.split('@')[1];
              if (data.domains.indexOf(emailDomain) > -1) {
                return Fliplet.DataSources.connect(APP_VALIDATION_DATA_DIRECTORY_ID).then(function (dataSource) {
                  var insertData = {};
                  insertData[DATA_DIRECTORY_COLUMN] = emailAddress;
                  dataSource.insert(insertData)
                    .then(greatSuccess);
                });
              }
            }

            // EMAIL NOT FOUND ON DATA SOURCE
            _this.html("Register");
            _this.removeClass("disabled").prop('disabled', false);
            $email_validation.find('.email-error').html("We couldn't find your email in our system. Try again or request an invite.");
            $email_validation.find('.state[data-state=auth] .form-group').addClass('has-error');
            calculateElHeight($email_validation.find('.state[data-state=auth]'));
          } else {
            // EMAIL FOUND ON DATA SOURCE BUT IS ALREADY REGISTERED
            _this.html("Register");
            _this.removeClass("disabled").prop('disabled', false);
            $email_validation.find('.email-error').html("You are already registed. Try logging in.");
            $email_validation.find('.state[data-state=auth] .form-group').addClass('has-error');
            calculateElHeight($email_validation.find('.state[data-state=auth]'));
          }

        });

      } else {
        // INVALID EMAIL
        _this.html("Register");
        _this.removeClass("disabled").prop('disabled', false);
        $email_validation.find('.state[data-state=auth] .form-group').addClass('has-error');
        calculateElHeight($email_validation.find('.state[data-state=auth]'));
      }
    });


    // HAVE CODE BUTTON
    $email_validation.find('.have-code').on('click', function () {
      // TRANSITION
      $email_validation.find('.state.present').removeClass('present').addClass('past');
      $email_validation.find('.input-email').text(userDataPV.email); // UPDATES TEXT WITH EMAIL

      calculateElHeight($email_validation.find('.state[data-state=verify-code]'));
      $email_validation.find('.state[data-state=verify-code]').removeClass('future').addClass('present');
    });

    // BACK BUTTON
    $email_validation.find('span.back').on('click', function () {
      $email_validation.find('.state.present').removeClass('present').addClass('future');

      $email_validation.find('.verify_email').val(""); // RESETS EMAIL VALUE ON PREVIOUS STATE
      $email_validation.find('.verify_pin').val(""); // RESETS EMAIL VALUE ON PREVIOUS STATE
      // REMOVES ERROR MESSAGE ON CURRENT STATE IF THERE IS ONE
      if ($email_validation.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
        $email_validation.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
      }

      $email_validation.find('.resend-code').parents('.state').removeClass('new-pin');
      //check the validation current state.
      if (userDataPV.code !== "" && userDataPV.code_generated_at > Date.now() - (CODE_VALID * 60 * 1000)) {
        $email_validation.find('.have-code').removeClass('hidden').addClass('show');
      }
      $email_validation.find('.verify-code').html("Verify").removeClass("disabled").prop('disabled', false);

      calculateElHeight($email_validation.find('.state[data-state=auth]'));
      $email_validation.find('.state[data-state=auth]').removeClass('past').addClass('present');
    });

    $email_validation.find('.verify-code').on('click', function () {
      var _this = $(this);
      _this.html("Verifying");
      _this.addClass("disabled").prop('disabled', true);

      var userPin = $email_validation.find('.verify_pin').val(),
          codeIsValid = userDataPV.code_generated_at > Date.now() - (CODE_VALID * 60 * 1000);

      $email_validation.find('.resend-code').parents('.state').removeClass('new-pin');
      // VERIFY PIN CODE
      if (userPin === userDataPV.code) {
        if (!codeIsValid) {
          $email_validation.find('.state[data-state=verify-code] .form-group').addClass('has-error');
          $email_validation.find('.resend-code').addClass('show');
          _this.html("Verify");
          _this.removeClass("disabled").prop('disabled', false);
          calculateElHeight($email_validation.find('.state[data-state=verify-code]'));
        } else {
          if ($email_validation.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
            $email_validation.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
          }

          userDataPV.verified = true;
          userDataPV.code = "";
          userDataPV.code_generated_at = "";
          Fliplet.Security.Storage.update().then(function () {
            _this.html("Verify");
            _this.removeClass("disabled").prop('disabled', false);

            $email_validation.find('.state.present').removeClass('present').addClass('past');
            calculateElHeight($email_validation.find('.state[data-state=confirmation]'));
            $email_validation.find('.state[data-state=confirmation]').removeClass('future').addClass('present');

            // Analytics - Info Event
            Fliplet.Analytics.info({ email: userDataPV.email, loginDate: (new Date()).toISOString()});
          });
        }
      } else {
        _this.html("Verify");
        _this.removeClass("disabled").prop('disabled', false);

        $email_validation.find('.state[data-state=verify-code] .form-group').addClass('has-error');
        calculateElHeight($email_validation.find('.state[data-state=verify-code]'));
      }
    });

    $email_validation.find('.resend-code').on('click', function () {
      $email_validation.find('.verify_pin').val("");
      if ($email_validation.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
        $email_validation.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
      }
      if ($email_validation.find('.resend-code').hasClass('show')) {
        $email_validation.find('.resend-code').removeClass('show');
      }

      $email_validation.find(this).parents('.state').addClass('new-pin');
      calculateElHeight($email_validation.find('.state[data-state=verify-code]'));

      sendNotification(emailAddress, function () {
        $email_validation.find('.verify_pin').val("");
        if ($email_validation.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
          $email_validation.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
        }
        if ($email_validation.find('.resend-code').hasClass('show')) {
          $email_validation.find('.resend-code').removeClass('show');
        }
      }, function () {
        $email_validation.find('.email-error').text(CONTACT_UNREACHABLE).addClass("show");
      });
    });

    $email_validation.find('.lock_continue').on('click', function () {
      if(typeof data.action !== "undefined") {
        Fliplet.Navigate.to(data.action);
      }
    });
    $email_validation.find('.btn-request-invite').on('click', function () {
      if(typeof data.inviteAction !== "undefined") {
        Fliplet.Navigate.to(data.inviteAction);
      }
    });
  }

  /**
   * used to validate an email field value
   * @param email email to test
   * @returns {boolean} true if valid, false if not.
   */
  function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }

// INITIATE FUNCTIONS
  function calculateElHeight(el) {

    var elementHeight = el.outerHeight();

    if (el.hasClass('start')) {
      if (havePinCode) {
        $email_validation.find('.state[data-state=auth]').addClass('has-code');
      }
      $email_validation.find('.state[data-state=auth]').removeClass('start').addClass('present');
    }

    el.parents('.content-wrapper').css('height', elementHeight);
    el.css('overflow', 'auto');
  }

  function setUserDataPV(success_callback, fail_callback) {
    var structure = {
      verified: false,
      code: "",
      code_generated_at: "",
      email: ""
    };

    window.pvName = "registration-data-source";
    Fliplet.Security.Storage.create(pvName, structure).then(function(data){
      window.userDataPV = data;
      success_callback();
    }, fail_callback);

  }

  if(Fliplet.Env.get('platform') === 'web') {

    $(document).ready(initEmailValidation);

    Fliplet.Studio.onEvent(function (event) {
      if (event.detail.event === 'reload-widget-instance') {
        setTimeout(function() {
          var $authState = $('.state[data-state=auth]');
          var elementHeight = $authState.outerHeight();

          $authState.removeClass('start').addClass('present');

          $authState.parents('.content-wrapper').css('height', elementHeight);
          $authState.css('overflow', 'auto');
        },500);
      }
    });

    $email_validation.on("fliplet_page_reloaded", initEmailValidation);
  } else {
    document.addEventListener("deviceready", initEmailValidation);
  }
});
