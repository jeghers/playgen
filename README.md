# playgen
### A playlist generator for streaming services like Liquidsoap

This background data service generates automatically randomized playlists.
I've been using it with Liquidsoap for several years now.

The playlist generator has the following features:

* Completely randomized song selection unattended 24/7
* Based on NodeJS/Express technologies
* Highly RESTful API
* Can be accessed programmatically with HTTP requests (including with "`curl`")
* Supports multiple playlists (e.g. for multiple program streams)
* Randomizes song playback with advanced features
    * Optimized randomization logic to insure maximum "fairness"
    * No song ever repeated until complete song list is gone through
    * Configurable deferral of duplicate song titles
    * Configurable deferral of duplicate song artists
* Automatic songlist generation for a directory full of song files
* New request feature allows a queue of specified song(s) to be
  unconditionally played next after the current song completes
* New download links feature allows specified song(s) to be made
  available as downloads via symbolic links deployed to the web 
  server of your choice
* Uses MySQL to store playlist options (the songs themselves are listed in
  text files)
* Can be modified to fall back on JSON text file for playlist options in case
  DB is not used
* I've not implemented HTTPS because I assume this will be used behind a firewall
  anyway.  Feel free to make such an enhancement and submit a PR.

Not only does "playgen" provide robust random song selection for services like
Liquidsoap, it also can provide song list and status information to other webapps
as well.  I have a web portal that shows me the full status of my Liquidsoap/Icecast
system, including displays of all the playlists, song requests and histories, and
the "playgen" API provides much of this data.

## **Prerequisites**

* NodeJS (at least version 12 recommended)

* MySQL (preferably running on localhost)

## **How the random selection works**

A simple selection of a random song from a list has several problems:

* The same song could get selected again while other songs are never
  selected at all.

* If there are many songs of the same title (different performances of
  the same song), then the same song could occur again soon after it was
  already heard.  Even if it was a different performance of the song, it
  is still an undesirable redundancy.

* More than once song from the same artist could be selected close to one
  another, which is also an undesirable redundancy.

* There is no guarantee that all songs in the list get an equally fair
  chance to be selected.

Playgen uses an algorithm for random song selection that overcomes all
these problems.  The following steps are taken:

1. Each song in the playlist is assigned a random number index between
   0.0 and 1.0.


2. The list is sorted according to the randomly-generated index numbers,
   enabling all the songs to now be accessed in a uniquely random
   sequence.


3. By iterating through the list according to the random indices, every
   song now can be selected with "equal fairness of selection opportunity".


4. The playlist can be configured to have a "redundant title threshold",
   which is how many songs you wish to hear before another song of the
   same title is allowed.  If a song with matching title occurs before
   this threshold is reached, it will be moved to a later point in the
   list.  This "postponement" of the song being selected can happen many
   times, depending on the contents of the playlist.  However, in the end,
   it is unlikely that the postponed songs would lose their chance to get
   selected and played: they would simply get selected later on.


5. The playlist can be configured to have a "redundant artist threshold",
   which is how many songs you wish to hear before another song from the
   same artist is allowed.  If a song with matching artist occurs before
   this threshold is reached, it will be moved to a later point in the
   list.  The behavior is very similar to the postponement of a redundant
   title described above.


6. These random selection rules are bypassed if and only if song requests
   are added to the request queue.  Then those songs will be selected
   first, whether their titles/artists were recently played or not.  After
   the request queue is depleted, then the random selection will resume.

If "playgen" is allowed to run long enough, every single song in the
playlist should get a chance to be selected and played before any songs
are selected again.  Redundant songs could be postponed, based on your
configuration of the redundant title and artist thresholds, but it is very
unlikely that this would prevent a song from ever getting played at all.
Only in extreme cases (e.g. many redundancies and high thresholds in a
small list) would a song never get selected (because it was repeatedly
postponed again and again).

## **How to deploy this software**

* Install a reasonably new version of NodeJS.  I recommend at least NodeJS
  version 12 (with npm version 6).  Use older versions at your own risk.

* `git clone` the software into a fresh new directory

* Run `npm install` to download all the dependency modules into node_modules

* Edit `config/default.js` to configure your MySQL database.  You can also
  customize `development.js` and `production.js` if desired, so that the
  two behave differently.  For example, you could point them to different
  databases, or have different logging levels.  You can also change the
  port (default `3000`).  Typical settings might look like this:
```
  db: {
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'YourDbSchemaName',
    reconnectTime: 1000, // if DB connection is lost, was this many ms to reconnect
  },
```
* Create the following table in your MySQL database, using the schema
  specified in `config/default.js`...
```
  CREATE TABLE `playlists` (
      `name` varchar(32) NOT NULL DEFAULT '',
      `filePath` varchar(512) DEFAULT NULL,
      `description` varchar(128) DEFAULT NULL,
      `redundantTitleThreshold` int(10) unsigned DEFAULT NULL,
      `redundantArtistThreshold` int(10) unsigned DEFAULT NULL,
      `partialTitleDelimiters` varchar(16) DEFAULT NULL,
      `songDetailsPluginName` varchar(32) DEFAULT NULL,
      PRIMARY KEY ('name')
  ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
```
* Populate the `playlists` table with details about your desired playlist(s), 
  refer to the "Playlist Configuration" section below for details.  You can
  directly add playlist rows to the table with SQL statements, or later (after
  starting the playlist generator service) you can use the `POST /api/vi/playlists`
  described in the "REST API Reference" below to create more entries.

  * Note: to avoid internal parsing errors, playlist names must not include any
  dash "-" characters.

* Use `npm run start` to run the playlist generator service

* The playlist generator can be accessed with API calls like these:

    * GET http://somehost:3000/api/v1/playlists

    * GET http://somehost:3000/api/v1/playlists/myplaylist

    * GET http://somehost:3000/api/v1/playlists/crimson/nextsong

    * GET http://somehost:3000/api/v1/playlists/crimson/currentsong

### **Docker support**

I have gotten "playgen" to work in a Docker container on CentOS 7 using the
provided Dockerfile and start/stop-docker.sh Bash scripts.  It is preliminary
and experimental, so I cannot guarantee how well it will work for anyone else,
but hopefully these files will help you to get started and experiment on your
own.  If you find any refinements, do share them back to me for possible
inclusion into this project.

### **Windows Service support**

Using the `node-windows` package, I have successfully deployed "playgen"
as a Windows Service on Windows 10, and it has successfully run all its
Unit Tests.  The supplied source files `windows-service-*.js` are used:

* `windows-service-config.js` is where the service is configured; you will
  need to edit it to match your directory paths and other requirements you
  might have.


* `windows-service-installs.js` installs the "playgen" Windows Service and
  starts it running.  You'll be prompted several times to grant elevated
  permissions since administrative changes are being made.


* `windows-service-uninstalls.js` stops and removes the "playgen" Windows
  Service.  You'll be prompted several times to grant elevated
  permissions since administrative changes are being made.  Uninstalling
  the `npm` project for "playgen" source code will *not* remove an installed
  Windows Service, you must stop and uninstall it first yourself.

Log files are generated, `node-windows` puts them in a `daemon`
subdirectory below the "playgen" root directory.  However, the logging is
not yet integrated into the Windows Event Service; the `node-windows`
library for event logging would not work properly for me, so I've suspended
those efforts for now.  If anyone can get it working, send me a PR and
I'll try it out.

`node-windows` is installed as a submodule within the "playgen" software
project.  If you prefer, you can install it globally (so other software
programs can use it too), but you'll need to understand how to use the
`npm` software to do so.  The `node-windows` documentation covers this
topic more.

To use this feature, I advise you to study the `node-windows` software
to better understand how it works at
https://github.com/coreybutler/node-windows

#### **Deploying "playgen" as a Windows Service**

* Go to the "playgen" root directory.


* Edit `windows-service-config.js` and adjust the configuration data
  to suit your needs.  Most importantly, set `script` to the proper
  directory path.  You can optionally adjust other settings if you like
  (at your own risk).
  

* To actually install the service, run this command:

```
    node windows-service-install.js
```
* Say "Yes" to all the permission prompts.


* If all goes well, the service will be installed and started.  Log files
  will be generated in a newly-created `daemon` subdirectory, along with
  several other service management file.  Do what you wish with the log
  files, but leave the other files alone.


* You can test "playgen" by calling some of its APIs using tools like
  Postman or the `curl` command (it is up to you to install and learn
  these tools).  Here are examples of `curl` commands:
```
    curl http://localhost:3000/api
    curl http://localhost:3000/api/v1
    curl http://localhost:3000/api/v1/playlists
```
* You can now start and stop the service just like any other Windows service
  using the standard Windows Service Management tools.


* To remove the service, run this command (saying "Yes" to permission
  prompts again):

```
    node windows-service-uninstall.js
```
* When you remove the service, the `daemon` subdirectory and its contents
  will be removed too.
## **The Configuration data**

In the source code folder `app/config` there is a configuration data structure that
can be modified to your own needs (_at your own risk!_).  Most typically, you need to
configure your MySQL database connection here, but there are other settings you might
find useful as well.  For example, you can change logging behavior or customize plugins
and their behavior.

There are three source files you can modify:

| Source file    | What it does |
| -------------- | ------------ |
| default.js     | The settings applied by default to the system, unless explicitly overridden |
| development.js | These settings are added into the default settings if running in development mode (`npm run start`) |
| production.js  | These settings are added into the default settings if running in production mode (`npm run start:prod`) |

The difference between development and production mode is entirely up to you; it depends
on what changes you make to these configuration files.  Nothing else changes in how the JS
code is executed at run time.

### **Different ways to deploy "playgen"**

You can deploy "playgen" either in "development" or "production" mode with
the following `npm` options:

| `npm` command        | NODE_ENV is set to this | Result |
| -------------------- | ----------------------- | ------ |
| `npm run start`      | `"development"`         | The settings in `config/development.js` are added to the default settings in `config/default.js` |
| `npm run start:prod` | `"production"`          | The settings in `config/production.js` are added to the default settings in `config/default.js` |

Depending on the settings of `config/development.js` and `config/production.js`,
you can make 'development' and 'production' mode be configured however you want.
You could point to a different database, use different plugins, change the logging
levels; it's totally up to you.

If you're writing custom plugin code, you can use `process.env.NODE_ENV` within
that code to see what mode the software is running in.

There is one more option: if you set the environment variable `PLAYGEN_CONFIG_JSON`
to the path of an existing JSON file, it will be read and added to your
configuration (unless errors occur while parsing the file).  You can use this
option as another way to customize your configuration at runtime.  The data
structure must match consistently with the config files data structure; any
additional fields will be ignored.

* A sample JSON configuration file `sampleConfig.json` is provided;
  `npm run start:sample-config-test` will run "playgen" including that
  custom configuration.  As an interesting example, it uses the `rsyslog`
  plugin to send logging to a remote `rsyslog` server; you must have a
  working `rsyslog` that accepts remote connections, and you must update
  `sampleConfig.json` so that the plugin's `remoteHost` parameter is
  set to your remote `rsyslog` server.

## **Unit Tests**

There is a Collection of API Unit Tests that can be used in "Postman" (a
programmers tool for testing data service APIs).  When configured properly,
"playgen" runs all the Unit Tests successfully.  You can also use this
Collection in Postman to experiment with, troubleshoot and exercise the
API calls provided in "playgen".

You'll need to be familiar with Postman in order to do these things.
Specifically, you must know how to import Collections, set up environment
variables, and run tests within a Collection.  This document does not
teach you how to use Postman.  You need to install Postman and learn how
to use it.

The file "`PlayGen tests.postman_collection.json`" can be used to import
the Collection of Unit Tests into Postman.  The tests presume that the
provided sample playlist data files exist and the MySQL database is populated
with their information.  Your song files must be under directory paths
that are correct in the playlist text files and DB tables too; if tests
fail, try checking for correct directory paths.

For the Postman tests to work, the following environment variable must be
set inside Postman.  The following table shows the required variables and
sample values.  You'll probably need to change the directory paths.

| Variable               | Initial Value                | Current Value                |
| ---------------------- | ---------------------------- | ---------------------------- |
| url_root               | http://localhost:3000/api    | http://localhost:3000/api    |
| url                    | http://localhost:3000/api/v1 | http://localhost:3000/api/v1 |
| sample_playlist_file   | "D:\\\\src\\\\playgen\\\\playlists\\\\johnson-playlist.txt" | "D:\\\\src\\\\playgen\\\\playlists\\\\johnson-playlist.txt" |
| sample_playlist_file_2 | "D:\\\\src\\\\playgen\\\\playlists\\\\retro-playlist.txt"   | "D:\\\\src\\\\playgen\\\\playlists\\\\retro-playlist.txt"   |

Notice that some values include double quotes and double backslashes.
Those are required, particularly in Windows environments.  You might
have to experiment and change them on other platforms.

## **Playlist Configuration**

In the `playlists` table, each row describes a different playlist.
For each playlist you wish to have, you must add one row to this table
describing that playlist.  The following columns are required in each row:

* `name`: the id for the playlist

* `filePath`: the absolute path to a text file naming all the songs in the
  playlist, there are sample files in the `playlists` directory.  Alternately,
  `filePath` can point to a directory full of song files, and all those files
  will be added to this playlist.

* `description`: a human-readable description of the playlist

* `redundantTitleThreshold`: the number of songs selected before another song
  with an identical name is allowed, unused if set to 0

* `redundantArtistThreshold`: the number of songs selected before another
  song with an identical artist is allowed, unused if set to 0

* `partialTitleDelimiters`: a collection of characters that will be treated
  as delimiters when comparing for duplicate titles.  For example, if set to
  "(,", then the titles "Sing Along", "Sing Along (live)", and "Sing Along,
  Sing With Me (medley)" would all be treated as identical titles because
  their first delimited sections are identical.  Any text after the delimiter
  characters are not considered in the name comparisons.

## **Playlist Filenames (and the "Standard Fielded Filename" format)**

For "playgen" to use your song files, by default they must be named in a very
specific way.  Details about the songs are embedded into the songs filenames.
By having this metadata in the filenames, the song files themselves can be
treated as totally content-agnostic, and there is no need for time-consuming
scanning through the song files for any other information.  This avoids the
complication of extracting metadata from MP3 tags (or whatever you might use
for other file formats).

The following fields are placed in the name of the song file, separated by dashes:

* Song Title
* Artist Name
* Album Title
* Record Label
* Year of Release

For example: your MP3 file contains the song "Pearline" by "Son House",
from an album "The Original Delta Blues" released by "Columbia Legacy" in 1965:

	title: Pearline
	artist: Son House
	album: The Original Delta Blues
	label: Columbia Legacy
	year: 1965

The filename should be:
```
Pearline-Son House-The Original Delta Blues-Columbia Legacy-1965.mp3
```
In this document, this is what we call a "**Standard Fielded Filename**".

You'll probably want to make some automated shell script program to take new
song files and convert them to this exact filename nomenclature.  That will
save you a lot of bother over time.

### ***Getting around the Standard Fielded Filename requirement***

Standard Fielded Filenames are the default way of getting song details in
"playgen".  While the initial renaming of your song files might be tedious,
you benefit from much faster startup performance after that.  Of course, this
may not be ideal for everyone, especially if your collection of song files is
big.  In that case you can use (or create) some different logic using the "plugin"
architecture described in the next section.

## **Customizing "playgen" with plugins**

A new design architecture has been introduced so that existing features can be
customized using "plugins".

A "plugin" is a small module of Javascript code that is:
* written by anyone, either me (the original developer) or you (the end user)
* it conforms to a well-defined interface (it provides predefined functions
  to do certain required tasks)
* you customize how the plugin does those tasks by writing your own custom logic
* The plugin is deployed into "playgen" by adding the code to the "playgen"
  source tree and registering it in the configuration file(s).
* A default plugin is always provided with some reasonable built-in behaviors.

This plugin architecture will support the following things:

* **Logging**: you can implement customized handling of log messages from the
  "playgen" server as it runs.  The default logging plugin will send
  messages to standard output using the Javascript console.  Available
  plugins included with playgen:
    * _console_ (default): send log messages to standard output via the Javascript `console` object
    * _localFile_: send log messages to a file of your choosing
    * _rsyslog_: send log messages to a `rsyslog` server (uses a
      `remoteHost` parameter to identify the server address)

* **Song Details**: you can implement your own custom logic
  for extracting details like title, artist, album, etc.  The default plugin
  assumes all song files use "Standard Fielded Filenames".  You will be able
  to bypass this requirement if you create your own plugin and implement
  some different logic.  Available
  plugins included with playgen:
    * _standardFieldedFilename_ (default): extracts song details from the filename
    * _mp3tags_: reads MP3 tags; this might slow startups considerably

The provided plugins can serve as a starting point for creating new
plugins, as well as examples to learn from.  You can copy one of those
and modify it to suit your needs.

Each different kind of plugin will have a different interface; that is, a
different set of well-defined functions that must be implemented.  But all
kinds of plugins will share one function in common: the "initPlugin"
function will be used to initialize all plugins when "playgen" starts.

When you write plugin functions, they need to be as reliable and fast as
possible.  Otherwise, "playgen" could become sluggish or unstable.  Do this
at your own risk.

Also, do not change the parameters of the interface functions or the plugin
architecture will be undermined.  You can omit trailing unused parameters but
don't add new parameters or change their ordering.

If you make a nice (and good quality) plugin, consider sharing it with a PR.

### **Registering your own plugin**

Once you have written a new plugin, you can register it with the following steps:

* Your plugin code must be in a Javascript file whose name ends with `.js`.
  * Starting implementation boilerplate files are provided for you to begin
    with: `app/plugins/logging/loggingTemplate.js` and
    `app/plugins/songDetails/songDetailsTemplate.js`.  You can make a copy
    with a different name and fill in your own implementation code.
  * Your plugin code must implement all the methods required for the type
    of plugin (logging or songDetails).  See the implementation requirements
    in the sections below.
  * All plugins must implement `initPlugin`, which is common to all plugins.
    If you have nothing to initialize, just provide an empty function.
  * Be sure to export all the plugin methods, and also a `name` property.
    This is important for the proper initialization of the plugin.  It should
    look like this example:
```
        module.exports = {
          name: 'myNewPlugin',
          initPlugin,
          log,
        };
```

* Place that Javascript file in the appropriate source code directory: for logging
  plugins `app/plugins/logging`, or for song details plugins `app/plugins/songDetails`.

* In the file `app/plugins/pluginImpls.js`, import the new code and add it to the
  `pluginImpls` list with something like this example:
```
    // import your plugin here
    const myNewLoggingPlugin = require('./logging/myNewPlugin');
       .
       .
    const pluginImpls = [
      ... other plugins ...
      myNewLoggingPlugin, <-- add your plugin to this list
    ];
```

* Add your plugin details to the config file(s).  Under `config.plugins.logging`
  or `config.plugins.songDetails` (depending on your type of plugin) there is an
  array of plugin definitions.  Add an entry for your new plugin to this array.
  For example, it might look like this:
```
      {
        name: 'myNewPlugin', // what you'll name the plugin
        params: [ // optional parameters, only if you need them in your code
          {
            name: 'myParam', // the name of your param
            value: 12345, // the value of your param
          },
        ],
        default: false, // optional, set true if you want this plugin used by default
        // but remember to remove the 'default: true' from other plugins of the same
        // type, only one plugin of any given type can be the 'default'!
      },
```

* Once your plugin is registered, it can be activated using the instructions below.

### **Logging plugins**

To create a new logging plugin, your Javascript code must implement the
following set of functions:

| Function                    | What the function does |
| --------------------------- | ---------------------- |
| `initPlugin(config,params)` | Initializes the plugin, the config data is provided in case some of its data may be needed, as well as any named parameters that may have been configured |
| `log(level,message)`        | Send the message to wherever logging is supposed to go, using the specified logging level |

"playgen" emits logging message with the following levels:
* `fatal`
* `error`
* `warn`
* `info`
* `debug`
* `none` (this is used to disable certain log messages within the code)

If you are sending these messages to a different logging service, then that
service might not use the same log levels as shown here, they could be slightly
different.  In that case, your plugin must convert these log levels to whatever
similar levels are provided in that logging service.

#### **Activating your logging plugin**

You can activate any logging plugin that has been registered by setting
`config.logType` in the configuration data to the name of the plugin you
wish to use.  This one global setting is used for all playlists.

### **Song Details plugins**

To create a new song details plugin, your Javascript code must implement the
following set of functions:

| Function                    | What the function does |
| --------------------------- | ---------------------- |
| `initPlugin(config,params)` | Initializes the plugin, the config data is provided in case some of its data may be needed, as well as any named parameters that may have been configured |
| `extract(songFile)`         | Given a song file name, learn the song details and return them in a data object |

The returned data object must have the following fields:
* title
* artist
* album
* label (the record company or publisher)
* year

If any of these fields are unavailable, you can omit them or set them to the
Javascript `undefined` keyword.  Just don't return an empty object or `null`
or `undefined`, at least return a title and artist.

If you add any additional fields, "playgen" will not recognize them, they
will be ignored.

#### **Activating your song details plugin**

Each playlist can have a different song details plugin activated by entering
the plugin name in the `songDetailsPluginName` column of that playlist row
in the `playlists` table in the MySQL database.  If that value is left `NULL`
in the database, then the default plugin will be used.

### **Configuring download links**

Optionally, "playgen" can make song files available to a web server for
downloading.  Using API calls, you can specify individual songs in a given
playlist, and symbolic links are deployed to the configured directory of
your choice (presumably a directory within your web server).  In this way,
the song files referenced by the deployed links are downloadable.

Optionally, you can configure an expiration time.  This means that the
download links will be deleted after the expiration time of your choice.
A repeating service task runs within "playgen" to periodically scan all
the download links, identify which ones are aged older then the expiration
time, and then delete them.

If you do not configure an expiration time, then the download links will
remain indefinitely until you delete them.

Here is an example of the downloads section of a "playgen" configuration:
```
  downloads: {
    enabled: true,
    downloadsPath: './downloads',
    scanIntervalMinutes: 15,
    // all expire times add up cumulatively
    expireTimeMinutes: 10,
    expireTimeHours: 16,
    // expireTimeDays: 7,
  },
```
To enable this download links feature, the `enabled` parameter must exist
and be set to true.  `downloadsPath` must also be provided, it can be either
an absolute or relative path (relative to the "playgen" home directory).
`IMPORTANT`: be sure the directory given by `downloadsPath` has write permission
settings such that playgen can create symbolic links there.

To set the expiration time, you can specify a combination of minutes, hours
and days.  They will be added together cumulatively to determine the total
expiration time.  It is okay to omit any of the three values you don't want
to use.  If you specify none, or the expiration time is zero, then no
expiration deletions will be done.

The scan interval is specified in minutes.  If an interval is unspecified,
then a default value of 5 minutes will be used.  If you specify a scan interval
of 2 minutes or less, then there will be no scans and no expiration deletions.
This is to avoid excessive churning of file system activity.


## **Liquidsoap Usage**

The "playgen" playlist generator service can be used with pretty much any
software that plays one song after another.  However, it was designed
specifically with Liquidsoap in mind, so here is an example of a Liquidsoap
configuration that uses "playgen" for song selections.

The system command `curl` is used to call the "playgen" API, the `?format=text`
option returns simple text instead of JSON for easier consumption by Liquidsoap.
There may be a more elegant way to call the API from Liquidsoap, feel free to
inform me if you know a better way.

This example is a partial excerpt of a Liquidsoap 1.4 configuration file.  The
code for Liquidsoap 2.0 might be slightly different.

```
playlistJingles = audio_to_stereo(playlist("~liquidsoap/playlists/jingles-playlist.txt"))

def retro_request_function() =
  result = get_process_output("curl 'http://localhost:3000/api/v1/playlists/retro/nextsong?format=text'")
  log("Next song "^result)
  request.create(result)
end

# ... more similar request functions here for other sources ...

# Create the sources
plr = request.dynamic(retro_request_function) # <-- this is where we call playgen
# Play a station ID jingle after every fourth song
plr = rotate(weights=[1,4], [playlistJingles, plr])

# ... more sources created here ...

output.icecast(
        %mp3(bitrate=48, id3v2=true),
        host="localhost", port=8000, password="some-password",
        mount="/retro", genre="Old Pre-War Blues",
        description="Retro Pre-war blues all the time",
        url="http://www.yourdomain.com:8000/retro",
        mksafe(plr))

# ... more sources connected to icecast here ...
```

## **REST API Reference**

Given: a host named `somehost` and port `3000`.

### Playlists
#### GET http://somehost:3000/api/v1/playlists

* Returns a list of all playlists 

_Sample response body_
```
{
  "status": "OK",
  "result": [
    {
      "name": "johnson",
      "filePath": "/usr/local/nodeapps/playgen/playlists/johnson-playlist.txt",
      "description": "Songs by Robert Johnson",
      "redundantTitleThreshold": 0,
      "partialTitleDelimiters": "",
      "redundantArtistThreshold": 0,
      "songCount": 29,
      "uri": "http://192.168.0.248:3000/api/v1/playlists/johnson"
    },
    ... etc etc etc ...
    {
      "name": "mod",
      "filePath": "/usr2/MOD/mp3-96kbps",
      "description": "Cool MOD Songs",
      "redundantTitleThreshold": 10,
      "partialTitleDelimiters": null,
      "redundantArtistThreshold": 5,
      "songCount": 59,
      "uri": "http://192.168.0.248:3000/api/v1/playlists/mod"
    }
  ],
  "count": 6
}
```

#### HEAD http://somehost:3000/api/v1/playlists

* Returns metadata for the collection of playlists

_Sample response headers_
```
"X-Count": "6"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "1759"
```

#### POST http://somehost:3000/api/v1/playlists

* Creates a new playlist

_Sample request body_
```
{
  "name": "sample",
  "filePath": "/usr/local/nodeapps/playgen/playlists/sample-playlist.txt",
  "description": "My playlist of cool songs",
  "partialTitleDelimiters": "(,/"
}
```
_Sample response body_
```
{
  "status": "OK",
  "uri": "http://192.168.0.248:3000/api/v1/playlists/sample",
  "message": "Playlist \"sample\" created"
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists

* Returns the supported command verbs for playlists

_Sample response headers_
```
"Allow": "GET,HEAD,POST"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}

* Returns info about the specified playlist (except for song details)

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "name": "sample",
    "filePath": "/usr/local/nodeapps/playgen/playlists/sample-playlist.txt",
    "description": "My playlist of cool songs",
    "redundantTitleThreshold": null,
    "partialTitleDelimiters": "(,/",
    "redundantArtistThreshold": null,
    "songCount": 29
  }
}
```

#### HEAD http://somehost:3000/api/v1/playlists/{playlist}

* Returns metadata for the specified playlist

_Sample response headers_
```
"X-Count": "29"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "250"
```

#### PUT http://somehost:3000/api/v1/playlists/{playlist}

* Commits a complete update of the playlist data (except for song details).
Any fields not given will be cleared.

_Sample request body_
```
{
  "name": "sample",
  "filePath": "/usr/local/nodeapps/playgen/playlists/other-playlist.txt",
  "description": "My altered playlist (modified)",
  "partialTitleDelimiters": "/(,",
  "redundantArtistThreshold": 5
}
```
_Sample response body_
```
{
  "status": "OK",
  "message": "Playlist \"sample\" updated"
}
```
If the `filePath` value is changed, the playlist will be reloaded.

#### PATCH http://somehost:3000/api/v1/playlists/{playlist}

* Commits a partial update of the playlist data (except for song details).
Any fields not given will be left unchanged.

_Sample request body_
```
{
    "description": "My altered playlist (modified again)",
    "redundantTitleThreshold": 10
}
```
_Sample response body_
```
{
  "status": "OK",
  "message": "Playlist \"sample\" updated"
}
```
If the `filePath` value is changed, the playlist will be reloaded.

#### DELETE http://somehost:3000/api/v1/playlists/{playlist}

* Deletes the specified playlist (the song files are unaffected and not removed)

_Sample response body_
```
{
  "status": "OK",
  "message": "Playlist \"sample\" deleted"
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}

* Returns the supported command verbs for the specified playlist

_Sample response headers_
```
"Allow": "GET,HEAD,PUT,PATCH,DELETE"
```

### Songs within a playlist

#### GET http://somehost:3000/api/v1/playlists/{playlist}/songs

* Returns a list of all the songs in the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "playlist": "crimson",
    "songs": [
      {
        "file": "/usr2/Blues/mp3-96kbps/Ain't No Grave-Crimson Blues-Just The Way We Roll (Then)-T4P-2013.mp3",
        "index": 0,
        "title": "Ain't No Grave",
        "artist": "Crimson Blues",
        "album": "Just The Way We Roll (Then)",
        "label": "T4P",
        "year": "2013",
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/0"
      },
      ... etc etc etc ...
      {
        "file": "/usr2/Blues/mp3-96kbps/You're Gonna Need Somebody On Your Bond-Crimson Blues-Live at Higher Power-T4P Music-2014.mp3",
        "index": 204,
        "title": "You're Gonna Need Somebody On Your Bond",
        "artist": "Crimson Blues",
        "album": "Live at Higher Power",
        "label": "T4P Music",
        "year": "2014",
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/204"
      }
    ],
    "count": 205
  }
}
```
By adding the option `?refresh=true` (or abbreviated `?refresh`) you can force
the playlist to reload the song list from its data file or directory.

#### HEAD http://somehost:3000/api/v1/playlists/{playlist}/songs

* Returns metadata for the songs in the specified playlist

_Sample response headers_
```
"X-Count": "205"
"X-Total-Count": "205"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "61418"
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/songs

* Returns the supported command verbs for the songs in the specified playlist

_Sample response headers_
```
"Allow": "GET,HEAD"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/songs/{songIndex}

* Returns a specified song in the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "file": "/usr2/Blues/mp3-96kbps/Amazing Grace-M24 Bluez Band-Don't You Know-Kingdom Voice-2017.mp3",
    "index": 2,
    "title": "Amazing Grace",
    "artist": "M24 Bluez Band",
    "album": "Don't You Know",
    "label": "Kingdom Voice",
    "year": "2017",
    "playlist": "crimson"
  }
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/songs/{songIndex}

* Returns the supported command verbs for a specified song in the specified
playlist

_Sample response headers_
```
"Allow": "GET"
```

### Song requests within a playlist

#### POST http://somehost:3000/api/v1/playlists/{playlist}/requests

* Creates a new song request for the specified playlist

_Sample request body_
```
{
    "songIndex": 22
}
```
_Sample response body_
```
{
  "status": "OK",
  "totalCount": 1,
  "song": {
    "file": "/usr2/Blues/mp3-96kbps/Come On Home-Crimson Blues-Unpublished-T4P-2013.mp3",
    "index": 22,
    "title": "Come On Home",
    "artist": "Crimson Blues",
    "album": "Unpublished",
    "label": "T4P",
    "year": "2013"
  },
  "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/22"
}
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/requests

* Returns a list of all the song requests for the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "result": {
  "playlist": "crimson",
  "requests": [
    {
      "songIndex": 22,
      "song": {
        "file": "/usr2/Blues/mp3-96kbps/Come On Home-Crimson Blues-Unpublished-T4P-2013.mp3",
        "index": 22,
        "title": "Come On Home",
        "artist": "Crimson Blues",
        "album": "Unpublished",
        "label": "T4P",
        "year": "2013"
      },
      "timestamp": 1622794948929,
      "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/22"
    },
    ... etc etc etc ...
    {
      "songIndex": 12,
      "song": {
        "file": "/usr2/Blues/mp3-96kbps/Cat's In The Microwave-Mark Jeghers-The Bluez Projekt-T4P Music-2005.mp3",
        "index": 12,
        "title": "Cat's In The Microwave",
        "artist": "Mark Jeghers",
        "album": "The Bluez Projekt",
        "label": "T4P Music",
        "year": "2005"
      },
      "timestamp": 1622794955161,
      "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/12"
    }
  ],
  "count": 5
  }
}
```

#### HEAD http://somehost:3000/api/v1/playlists/{playlist}/requests

* Returns metadata for the song requests for the specified playlist

_Sample response headers_
```
"X-Count": "5"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "1242"
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/requests

* Returns the supported command verbs for the song requests for the
specified playlist

_Sample response headers_
```
"Allow": "POST,GET,HEAD"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/requests/{requestIndex}

* Returns the specified song request for the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "song": {
      "file": "/usr2/Blues/mp3-96kbps/Cat's In The Microwave-Mark Jeghers-The Bluez Projekt-T4P Music-2005.mp3",
      "index": 12,
      "title": "Cat's In The Microwave",
      "artist": "Mark Jeghers",
      "album": "The Bluez Projekt",
      "label": "T4P Music",
      "year": "2005"
    },
    "playlist": "crimson",
    "songIndex": 12,
    "timestamp": 1622794955161,
    "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/12"
  }
}
```

#### DELETE http://somehost:3000/api/v1/playlists/{playlist}/requests/{requestIndex}

* Deletes the specified song request for the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "message": "Playlist \"crimson\" song request 3 deleted"
}
```
### Next/current song in a playlist

#### GET http://somehost:3000/api/v1/playlists/{playlist}/nextsong

* Returns the next song selection for the specified playlist.  The song
selection will either be a randomly-generated song selection, or, if the
request queue is not empty, the first song request will be selected and
removed from the request queue.

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "index": 107,
    "song": {
      "file": "/usr2/Blues/mp3-96kbps/Nothin' But The Blood-Salinas-2013-Crimson Blues-Unpublished-T4P-2013.mp3",
      "index": 107,
      "title": "Nothin' But The Blood",
      "artist": "Salinas",
      "album": "2013",
      "label": "Crimson Blues",
      "year": "Unpublished",
      "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/107"
    },
    "playlist": "crimson"
  }
}
```
Instead of returning the normal JSON data, the option `?format=text` can
be used to return simple text:

_Sample response body using simple text format_
```
[root@linux liquidsoap]# curl http://localhost:3000/api/v1/playlists/retro/nextsong?format=text
/usr2/Blues/mp3-96kbps/Mind Reader Blues-Bertha Lee-Complete Recordings 1929 to 1934 (1930 to 1934)-JSP Records-2002.mp3
[root@linux liquidsoap]# _
```
While JSON is normally the best format most of the time, simple text is
quite handy for returning data to Liquidsoap (see the example above).  The
simple text option is only provided for this one API endpoint.

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/nextsong

* Returns the supported command verbs for the next song selection

_Sample response headers_
```
"Allow": "GET"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/currentsong

* Returns the latest song selection for the specified playlist.  This does
not cause any new song selection to occur, it simply reports what the most
recent song selection was.

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "index": 107,
    "song": {
      "file": "/usr2/Blues/mp3-96kbps/Nothin' But The Blood-Salinas-2013-Crimson Blues-Unpublished-T4P-2013.mp3",
      "index": 107,
      "title": "Nothin' But The Blood",
      "artist": "Salinas",
      "album": "2013",
      "label": "Crimson Blues",
      "year": "Unpublished",
      "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/107"
    },
    "playlist": "crimson"
  }
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/currentsong

* Returns the supported command verbs for the current song selection

_Sample response headers_
```
"Allow": "GET"
```

### Song history within a playlist

#### GET http://somehost:3000/api/v1/playlists/{playlist}/history

* Returns the history list of all the songs selected for the specified playlist.
The history list remembers all songs selected or requested for this playlist
since the "playgen" service started running, up to a maximum limit coded in the
config source files.

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "playlist": "crimson",
    "history": [
      {
        "index": 107,
        "song": {
          "file": "/usr2/Blues/mp3-96kbps/Nothin' But The Blood-Salinas-2013-Crimson Blues-Unpublished-T4P-2013.mp3",
          "index": 107,
          "title": "Nothin' But The Blood",
          "artist": "Salinas",
          "album": "2013",
          "label": "Crimson Blues",
          "year": "Unpublished",
          "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/107"
        },
        "timestamp": 1622795620170,
        "historyIndex": 0,
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/history/0"
      },
      ... etc etc etc ...
      {
        "index": 168,
        "song": {
          "file": "/usr2/Blues/mp3-96kbps/The Hand Of God-Crimson Blues-KSAR 15 TV Studio-T4P Music-2014.mp3",
          "index": 168,
          "title": "The Hand Of God",
          "artist": "Crimson Blues",
          "album": "KSAR 15 TV Studio",
          "label": "T4P Music",
          "year": "2014",
          "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/168"
        },
        "timestamp": 1622634924268,
        "historyIndex": 499,
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/history/499"
      }
    ],
    "count": 500
  }
}
```

#### HEAD http://somehost:3000/api/v1/playlists/{playlist}/history

* Returns metadata for the history of all the songs selected for the
specified playlist

_Sample response headers_
```
"X-Count": "500"
"X-Total-Count": "500"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "217640"
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/history

* Returns the supported command verbs for the history list for the specified
playlist

_Sample response headers_
```
"Allow": "GET,HEAD"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/history/{songIndex}

* Returns the specified song in the history list for the specified playlist

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "index": 71,
    "song": {
      "file": "/usr2/Blues/mp3-96kbps/I Know, I Know, I Know-Crimson Blues-Live at Higher Power-T4P Music-2014.mp3",
      "index": 71,
      "title": "I Know, I Know, I Know",
      "artist": "Crimson Blues",
      "album": "Live at Higher Power",
      "label": "T4P Music",
      "year": "2014",
      "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/71"
    },
    "timestamp": 1622795553553,
    "playlist": "crimson"
  }
}
```
#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/history/{songIndex}

* Returns the supported command verbs for the specified song in the history list
for the specified playlist

_Sample response headers_
```
"Allow": "GET"
```

### Song download links for a playlist

#### GET http://somehost:3000/api/v1/downloads

* Returns the list of all the songs available for download for all playlists.  The downloads list is derived from scanning all the symbolic links to song files in the configured download directory.

_Sample response body_
```
{
    "status": "OK",
    "result": {
        "playlists": [
            {
                "playlist": "somePlayList",
                "downloadLinks": [
                    {
                        "songIndex": 3,
                        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList-3-My_Bird_Won't_Sing.mp3",
                        "songPath": "D:\\src\\playgen\\playlists\\some-play-list\\My Bird Won't Sing (snippet)-Ticket To Chicago-Dave Hole-Allligator Records-1997.mp3",
                        "downloadIndex": 0
                    },
                    {
                        "songIndex": 4,
                        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList-4-Rats_'N'_Roaches.mp3",
                        "songPath": "D:\\src\\playgen\\playlists\\some-play-list\\Rats 'N' Roaches (snippet)-Mark Jeghers-The Bluez Projekt-T4P Music-2005.mp3",
                        "downloadIndex": 1
                    },
                    {
                        "songIndex": 6,
                        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList-6-We_All_Gonna_Face_the_Rising_Sun.mp3",
                        "songPath": "D:\\src\\playgen\\playlists\\some-play-list\\We All Gonna Face the Rising Sun (snippet)-Delta Big Four-Complete Recordings 1929 to 1934 (1930 to 1934)-JSP Records-2002.mp3",
                        "downloadIndex": 2
                    }
                ],
                "downloadsCount": 3
            },
            {
                "playlist": "anotherPlayList",
                "downloadLinks": [
                    {
                        "songIndex": 4,
                        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList2-4-Exploration_-_Purple_Motion.mp3",
                        "songPath": "D:\\src\\playgen\\playlists\\another-play-list\\Exploration (snippet)-Purple Motion-Mod Snippets-Unlabeled-1992.mp3",
                        "downloadIndex": 0
                    },
                    {
                        "songIndex": 7,
                        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList2-7-The_Evening_Blues_-_Cyberius_Ariadne.mp3",
                        "songPath": "D:\\src\\playgen\\playlists\\another-play-list\\The Evening Blues (snippet)-Cyberius Ariadne-Mod Snippets-Unlabeled-1999.mp3",
                        "downloadIndex": 1
                    }
                ],
                "downloadsCount": 2
            }
        ],
        "playlistCount": 2,
        "downloadLinksTotalCount": 5
    }
}
```

#### HEAD http://somehost:3000/api/v1/downloads

* Returns metadata for all the songs available for download for all playlists

_Sample response headers_
```
"X-Playlist-Count": "2"
"X-DownloadLinks-Total-Count": "5"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "1514"
```

#### OPTIONS http://somehost:3000/api/v1/downloads

* Returns the supported command verbs for all the songs available for download for all playlists

_Sample response headers_
```
"Allow": "GET,HEAD"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/downloads

* Returns the list of all the songs available for download for the specified playlist.
  The downloads list remembers all songs selected or requested for this playlist
  since the "playgen" service started running, up to a maximum limit coded in the
  config source files.

_Sample response body_
```
{
  "status": "OK",
  "result": {
    "playlist": "crimson",
    "downloads": [
      {
        "index": 107,
        "song": {
          "file": "/usr2/Blues/mp3-96kbps/Nothin' But The Blood-Salinas-2013-Crimson Blues-Unpublished-T4P-2013.mp3",
          "index": 107,
          "title": "Nothin' But The Blood",
          "artist": "Salinas",
          "album": "2013",
          "label": "Crimson Blues",
          "year": "Unpublished",
          "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/107"
        },
        "timestamp": 1622795620170,
        "downloadsIndex": 0,
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/downloads/0"
      },
      ... etc etc etc ...
      {
        "index": 168,
        "song": {
          "file": "/usr2/Blues/mp3-96kbps/The Hand Of God-Crimson Blues-KSAR 15 TV Studio-T4P Music-2014.mp3",
          "index": 168,
          "title": "The Hand Of God",
          "artist": "Crimson Blues",
          "album": "KSAR 15 TV Studio",
          "label": "T4P Music",
          "year": "2014",
          "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/songs/168"
        },
        "timestamp": 1622634924268,
        "downloadsIndex": 499,
        "uri": "http://192.168.0.248:3000/api/v1/playlists/crimson/downloads/499"
      }
    ],
    "count": 500
  }
}
```

#### HEAD http://somehost:3000/api/v1/playlists/{playlist}/downloads

* Returns metadata for the downloads of all the songs selected for the
  specified playlist

_Sample response headers_
```
"X-Count": "500"
"X-Total-Count": "500"
"Content-Type": "application/json; charset=utf-8"
"Content-Length": "217640"
```

#### POST http://somehost:3000/api/v1/playlists/{playlist}/downloads

* Creates a new downloadable link to a specified song in a specified playlist

_Sample request body_
```
{
    "songIndex": 3
}
```
_Sample response body_
```
{
    "status": "OK",
    "result": {
        "playlist": "somePlayList",
        "songToDownload": {
            "title": "My Bird Won't Sing",
            "detailsLoaded": true,
            "index": 3,
            "file": "D:\\src\\playgen\\playlists\\some-play-list\\My Bird Won't Sing (snippet)-Ticket To Chicago-Dave Hole-Allligator Records-1997.mp3",
            "artist": "Ticket To Chicago",
            "album": "Dave Hole",
            "year": "1997"
        },
        "symLinkPath": "D:\\src\\playgen\\downloads\\song-somePlayList-3-My_Bird_Won't_Sing.mp3"
    }
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/downloads

* Returns the supported command verbs for the downloads list for the specified
  playlist

_Sample response headers_
```
"Allow": "GET,HEAD"
```

#### GET http://somehost:3000/api/v1/playlists/{playlist}/downloads/{songIndex}

* Returns the specified download link for the specified playlist

_Sample response body_
```
{
    "status": "OK",
    "result": {
        "playlist": "somePlayList",
        "downloadIndex": 1,
        "linkPath": "D:\\src\\playgen\\downloads\\song-somePlayList-4-Rats_'N'_Roaches.mp3",
        "song": {
            "title": "Rats 'N' Roaches",
            "detailsLoaded": true,
            "index": 4,
            "file": "D:\\src\\playgen\\playlists\\some-play-list\\Rats 'N' Roaches (snippet)-Mark Jeghers-The Bluez Projekt-T4P Music-2005.mp3",
            "artist": "Mark Jeghers",
            "album": "The Bluez Projekt",
            "label": "T4P Music",
            "year": "2005"
        }
    }
}
```

#### OPTIONS http://somehost:3000/api/v1/playlists/{playlist}/downloads/{songIndex}

* Returns the supported command verbs for the specified song in the downloads list
  for the specified playlist

_Sample response headers_
```
"Allow": "GET,HEAD,DELETE"
```

#### DELETE http://somehost:3000/api/v1/playlists/{playlist}/downloads/{songIndex}

* Deletes the specified download link for the specified playlist

_Sample response headers_
```
{
    "status": "OK",
    "message": "Download link \"D:\\src\\playgen\\downloads\\song-somePlayList-4-Rats_'N'_Roaches.mp3\" deleted"
}
```
