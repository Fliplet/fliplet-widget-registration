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
  var emailTemplate = $('#template-email-validation').html();

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

  // TinyMCE INIT
  tinymce.init({
    selector: '#validationEmail',
    theme: 'modern',
    plugins: [
      'advlist lists link image charmap hr',
      'searchreplace insertdatetime table textcolor colorpicker code'
    ],
    toolbar: 'formatselect | fontselect fontsizeselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | link | bullist numlist outdent indent | blockquote subscript superscript | table charmap hr | removeformat | code',
    menubar: false,
    statusbar: true,
    inline: false,
    resize: true,
    min_height: 300
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
    data.domains = [];
    var domains = $('#domains').val().replace(/\s+/g, '');
    if (domains !== '') {
      data.domains = domains.split(',');
    }

    // Get and save values to data
    fields.forEach(function (fieldId) {
      data[fieldId] = $('#' + fieldId).val();
    });

    data.emailTemplate = tinymce.get('validationEmail').getContent();

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

  $('#open-advanced').on('click', function() {
    if ($('.regex-options').hasClass('show')) {
      $('.regex-options').removeClass('show');
    } else {
      $('.regex-options').addClass('show');
    }

  });

  $('#help_tip').on('click', function() {
    alert("During beta, please use live chat and let us know what you need help with.");
  });

  function initialiseData() {

    if ( "emailTemplate" in data ) {
      tinymce.get('validationEmail').setContent(data.emailTemplate);
    } else {
      tinymce.get('validationEmail').setContent(emailTemplate);
    }

    if ( "domains" in data ) {
      $('#domains').val(data.domains.join(','));
      $('.regex-options').addClass('show');
    }

    fields.forEach(function (fieldId) {
      if( fieldId in data ) {
        $('#' + fieldId).val(data[fieldId]).change();
      }
    });

    if ( "allowInvite" in data ) {
      $('#allow_invite').trigger('change');
    }
  }

})();
