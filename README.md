# playgen
Playlist generator for streaming services like liquidsoap

This background data service generates automatically randomized playlists.  I've been using it with liquidsoap for several years now.
 
The playlist generator has the following features:

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
* Uses MySQL to store playlist options (the songs themselves are listed in text files)
* Can be made to fall back on JSON text file for playlist options in case DB is not used

## **Prerequisites**

* NodeJS (version 12 recommended)

* MySQL (preferably running on localhost)

## **How the random selection works**



## **How to deploy this software**

* Install a reasonable new version of NodeJS.  I recommend NodeJS version 12 (with npm version 6).  Use older versions at your own risk.

* git clone the software into a fresh new directory

* Run npm install to download all the dependancy modules into node_modules

* Edit config/default.js to configure your MySQL database (you can also customize development.js and production.js if desired)

* Create the following table in your MySQL database, using the schema specified in config/default.js
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
* Populate the 'playlists' table with details about your desired playlist(s), refer to the "Playlist Configuration" section below for details

* Use npm run start to run the playlist generator service

* The playlist generator can be accessed with API calls like these:

	* GET http://localhost:3000/api/playlists

	* GET http://localhost:3000/api/playlists/myplaylist

	* GET http://localhost:3000/api/playlists/crimson/nextsong

	* GET http://localhost:3000/api/playlists/crimson/currentsong

## **Playlist Configuration**

In the 'playlists' table, each row describes a different playlist.  For each playlist you wish to have, you must add one row to this table describing that playlist.  The following columns are required in each row:

* name: the id for the playlist

* filePath: the absolute path to a text file naming all the songs in the playlist, sample files are in the "playlists" directory

* description: a human-readable description of the playlist

* redundantTitleThreshold: the number of songs selected before another song with an identical name is allowed, unused if set to 0

* partialTitleDelimiters: a collection of characters that will be treated as delimiters when comparing for duplicate titles.  For example, if set to "(,", the the titles "Sing Along", "Sing Along (live)", and "Sing Along, Sing With Me (medley)" would all be treated as identical titles because their first delimited sections are identical.

* redundantArtistThreshold: the number of songs selected before another song with an identical artist is allowed, unused if set to 0

## **Playlist Filenames**

For "playgen" to use your song files, they must be named in a very specific way.  Details about the songs are embedded into the songs filenames.  By having this metadata in the filenames, the song files themselves can be treated as totally content-agnostic, and there is no need for time consuming parsing through the song files for any other information.  This avoids the complication of extracting metadata from MP3 tags (or whatever you might use for other file formats).

The following fields are placed in the name of the song file, separated by dashes:

* Song Title
* Artist Name
* Album Title
* Record Label
* Year of Release

For example: your MP3 file contains the song "Pearline" by "Son House", from an album "The Original Delta Blues" released by "Columbia Legacy" in 1965:

	title: Pearline
	artist: Son House
	album: The Original Delta Blues
	label: Columbia Legacy
	year: 1965

The filename should be:
```
Pearline-Son House-The Original Delta Blues-Columbia Legacy-1965.mp3
```
You'll probably want to make some automated shell script program to take new song files and convert them to this exact filename nomenclature.  That will save you a lot of bother over time.

## **REST API Reference**

xxx
