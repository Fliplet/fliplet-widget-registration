//interface js
(function(){

  var widgetId = Fliplet.Widget.getDefaultId();
  var data = Fliplet.Widget.getData(widgetId) || {};
  var organizationId = Fliplet.Env.get('organizationId');
  var validInputEventName = 'interface-validate';

  var allDataSources;
  var templates = {
    dataSourceEntry: template('data-source-entry')
  };

  var fields = [
    'dataSource',
    'emailColumn',
    'otherColumn'
  ];

  var linkActionProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#link-actions',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: data.action,
    // Events fired from the provider
    onEvent: function (event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });

  var inviteActionProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#request-invitation-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: data.inviteAction,
    // Events fired from the provider
    onEvent: function (event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });

  // 1. Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
  });

  // 2. Fired when the user submits the form
  $('form').submit(function (event) {
    event.preventDefault();
    linkActionProvider.forwardSaveRequest();
    inviteActionProvider.forwardSaveRequest();
  });

  // 3. Fired when the provider has finished
  linkActionProvider.then(function (result) {
    data.action = result.data;
    save(true);
  });

  inviteActionProvider.then(function (result) {
    data.inviteAction = result.data;
    save(true);
  });

  // Function to compile a Handlebars template
  function template(name) {
    return Handlebars.compile($('#template-' + name).html());
  }

  function save(notifyComplete) {
    // Get and save values to data
    fields.forEach(function (fieldId) {
      data[fieldId] = $('#' + fieldId).val();
    });

    Fliplet.Widget.save(data).then(function () {
      if (notifyComplete) {
        Fliplet.Widget.complete();
        window.location.reload();
      } else {
        Fliplet.Studio.emit('reload-widget-instance', widgetId);
      }
    });
  }

  Fliplet.Widget.emit(validInputEventName, {
    isValid: false
  });

  Fliplet.DataSources.get({ organizationId: organizationId }).then(function (dataSources) {
    allDataSources = dataSources;
    dataSources.forEach(renderDataSource);
    return Promise.resolve();
  }).then(initialiseData);

  function renderDataSource(dataSource){
    $('#dataSource').append(templates.dataSourceEntry(dataSource));
  }

  function renderDataSourceColumn(dataSourceColumn){
    $('#emailColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
    $('#otherColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
  }

  $('#dataSource').on('change', function onDataSourceListChange() {
    var selectedOption = $(this).find("option:selected"),
        selectedText = selectedOption.text(),
        selectedValue = selectedOption.val();

    $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
    $('#emailColumn option:gt(0)').remove();
    $('#otherColumn option:gt(0)').remove();

    if ( $(this).val() !== "none" ) {
      $('.registration-options').removeClass('hidden');
    } else {
      $('.registration-options').addClass('hidden');
    }

    allDataSources.forEach(function(dataSource){
      if(dataSource.id == selectedValue && typeof dataSource.columns !== "undefined") {
        dataSource.columns.forEach(renderDataSourceColumn);
      }
    });
  });

  $('#emailColumn, #otherColumn').on('change', function onDataColumnListChange() {
    var selectedOption = $(this).find("option:selected"),
        selectedText = selectedOption.text(),
        selectedValue = selectedOption.val();

    $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
    Fliplet.Widget.emit(validInputEventName, {
      isValid: selectedValue !== 'none'
    });
  });

  $('#appName').on('keyup change paste', $.debounce(function() {
    save();
  }, 500));

  $('#allow_invite').on('change', $.debounce(function() {

    if ( $(this).is(':checked') ) {
    	$('.new-invite-redirect').removeClass('hidden');
      data.allowInvite = true;
    } else {
    	$('.new-invite-redirect').addClass('hidden');
      data.allowInvite = false;
    }

    save();

  }, 0));

  $('#help_tip').on('click', function() {
    alert("During beta, please use live chat and let us know what you need help with.");
  });

  function initialiseData() {
    fields.forEach(function (fieldId) {
      if(data[fieldId]) {
        $('#' + fieldId).val(data[fieldId]).change();
      }
    });

    if ( data.allowInvite ) {
      $('#allow_invite').trigger('change');
    }
  }

})();
