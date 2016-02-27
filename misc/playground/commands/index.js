var exec = require('child_process').exec;

exec("mailq | tail -1 | grep -Eo '[0-9]*.Request' | sed 's/ Request//'",
    function(error,stdout,stderr)
    {
        if( stdout )
        {
        }
        else // we have queued mails here
        {
        }
    });
