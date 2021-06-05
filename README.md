# playgen
### A playlist generator for streaming services like liquidsoap

This background data service generates automatically randomized playlists.
I've been using it with liquidsoap for several years now.
 
The playlist generator has the following features:

* Completely randomized song selection unattended 24/7
* Based on NodeJS/Express technologies
* Highly RESTful API
* Can be accessed programmatically with HTTP requests (including with 'curl')
* Supports multiple playlists (e.g. for multiple program streams)
* Randomizes song playback with advanced features
    * Optimize randomization logic to insure maximum "fairness"
    * No song ever repeated until complete song list is gone through
    * Configurable deferral of duplicate song titles
    * Configurable deferral of duplicate song artists
* Automatic songlist generation for a directory full of song files
* New request feature allows a queue of specified song(s) to be
  unconditionally played next after the current song completes
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
"playgen" provides much of this data.

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
small list) would a song never get selected (because it was postponed so
often).

## **How to deploy this software**

* Install a reasonable new version of NodeJS.  I recommend at least NodeJS version 12
  (with npm version 6).  Use older versions at your own risk.

* git clone the software into a fresh new directory

* Run npm install to download all the dependancy modules into node_modules

* Edit config/default.js to configure your MySQL database (you can also
  customize development.js and production.js if desired).  You can also
  change the port (default 3000).

* Create the following table in your MySQL database, using the schema
  specified in config/default.js
```
  CREATE TABLE 'playlists' (
      'name' varchar(32) NOT NULL DEFAULT '',
      'filePath' varchar(512) DEFAULT NULL,
      'description' varchar(128) DEFAULT NULL,
      'redundantTitleThreshold' int(10) unsigned DEFAULT NULL,
      'partialTitleDelimiters' varchar(16) DEFAULT NULL,
      'redundantArtistThreshold' int(10) unsigned DEFAULT NULL,
      PRIMARY KEY ('name')
  ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
```
* Populate the 'playlists' table with details about your desired playlist(s), 
  refer to the "Playlist Configuration" section below for details.  You can
  directly add rows to the table, or later (after starting the playlist generator
  service) you can use the `POST /api/vi/playlists` described in the "REST
  API Reference" below to create more entries.

* Use npm run start to run the playlist generator service

* The playlist generator can be accessed with API calls like these:

	* GET http://somehost:3000/api/playlists

	* GET http://somehost:3000/api/playlists/myplaylist

	* GET http://somehost:3000/api/playlists/crimson/nextsong

	* GET http://somehost:3000/api/playlists/crimson/currentsong

## **Playlist Configuration**

In the 'playlists' table, each row describes a different playlist.  For each
playlist you wish to have, you must add one row to this table describing
that playlist.  The following columns are required in each row:

* name: the id for the playlist

* filePath: the absolute path to a text file naming all the songs in the
  playlist, sample files are in the "playlists" directory

* description: a human-readable description of the playlist

* redundantTitleThreshold: the number of songs selected before another song
  with an identical name is allowed, unused if set to 0

* partialTitleDelimiters: a collection of characters that will be treated
  as delimiters when comparing for duplicate titles.  For example, if set to
  "(,", the the titles "Sing Along", "Sing Along (live)", and "Sing Along,
  Sing With Me (medley)" would all be treated as identical titles because
  their first delimited sections are identical.

* redundantArtistThreshold: the number of songs selected before another
song with an identical artist is allowed, unused if set to 0

## **Playlist Filenames**

For "playgen" to use your song files, they must be named in a very specific way.
Details about the songs are embedded into the songs filenames.  By having this
metadata in the filenames, the song files themselves can be treated as totally
content-agnostic, and there is no need for time-consuming parsing through the
song files for any other information.  This avoids the complication of
extracting metadata from MP3 tags (or whatever you might use for other file
formats).

The following fields are placed in the name of the song file,
separated by dashes:

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
You'll probably want to make some automated shell script program to take new
song files and convert them to this exact filename nomenclature.  That will
save you a lot of bother over time.

In future versions, I might add support for reading MP3 tags, but this
filename nomenclature will still remain the main way of parsing out song
data for the sake of speed and simplicity.

## **Liquidsoap Usage**

The "playgen" playlist generator service can be used with pretty much any
software that plays one song after another.  However, it was designed
specifically with Liquidsoap in mind, so here is an example of a Liquidsoap
configuration that uses "playgen" for song selections.

The system command 'curl' is used to call the "playgen" API, the "?format=text"
returns simple text instead of JSON for easier consumption by Liquidsoap.
There may be a more elegant way to call the API from Liquidsoap, feel free to
inform me if you know a better way.

This example is a partial excerpt of the total configuration file.

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
Sample request body
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
since the playgen service started running, up to a maximum limit coded in the
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
