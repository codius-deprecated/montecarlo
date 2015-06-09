$(function() {
  console.log("fetching status");
  prTemplate = Handlebars.compile($('#build-row-template').html());
  $.ajax('/status').done(function(data) {
    $('#loader').hide('slow', function() {
      console.log(data);
      $(data.Reviews).each(function (idx, review) {
        var row = $(prTemplate(review));
        row.hide();
        $('#pull-requests').append(row);
        row.show('normal');
      });
    });
  });
});
