/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
    /**
    * Array of application names.
    */
    app_name : ['theeye_supervisor'],
    /**
    * Your New Relic license key.
    */
    license_key : '16f245eaf43c63ffe13768d93b35f131071e40e6',
    logging : {
        /**
        * Level at which to log. 'trace' is most useful to New Relic when diagnosing
        * issues with the agent, 'info' and higher will impose the least overhead on
        * production applications.
        */
        level : 'info'
    }
};
