module.exports = ({ env }) => ({
    host: env('HOST', '0.0.0.0'),
    url: env('MY_HEROKU_URL'),
    port: env.int('PORT', 1337),
    proxy: true,
    app: {
        keys: env.array('APP_KEYS'),
    },
});