-- Apply only on authorized release after schema validation.
select cron.schedule('dartarena-player-report-evidence-retention','23 * * * *','select dartarena_moderation_private.purge_expired_evidence();');
