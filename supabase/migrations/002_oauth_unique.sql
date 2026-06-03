alter table oauth_tokens add constraint oauth_tokens_user_provider_unique unique (user_id, provider);
