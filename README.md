# study-bundles-wistia-clean

Clean out the unused Wistia videos. Will confirm with you before anything happens!

## Usage

```sh
node index --settings-path=/home/studybundles/studybundles/settings.json
# or
node index --wistia-api-password=xxxxxxxxxx
```

## Options

### `--wistia-api-password` (required)

Specify the Wistia API password you want to use.

### `--settings-path`

Specify the path to the Meteor `settings.json` file (so we can get the Wistia api password). Required if `--wistia-api-password` is not specified.

### `--mongo-uri`

URI to the StudyBundles database. Default: `mongodb://localhost/studybundles`

## Debug

This project uses [debug](https://www.npmjs.com/package/debug) so you can have debug messages logged to the console by setting the `DEBUG` environment variable to `*` or `wistia-clean*`.
