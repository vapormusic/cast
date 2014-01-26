/*!
 * FM4cast - FM4 chromecast receiver/sender
 * http://sehaas.github.io/fm4cast
 *
 * Copyright 2013,2014 Sebastian Haas (sehaas@deebas.com)
 * Released under the MIT license
 *
 */

;( function( $ ) {

	CastSource = function(opts) {
		this.title = null;
		this.url = null;
		this.logo = null;
		this.parent = null;
		this.children = [];
		this.text = null;
		this.date = null;

		$.extend(this, opts);
	},

	CastSource.prototype = {
		getLogo : function() {
			if (this.logo) {
				return this.logo;
			}
			if (this.parent) {
				return this.parent.getLogo();
			}
			return null;
		},

		getTitle : function() {
			if (this.title) {
				return this.title;
			}
			if (this.parent) {
				return this.parent.getTitle();
			}
			return null;
		},

		addChild : function(child, usedate) {
			if (!child) {
				return;
			}
			child.parent = this;
			this.children.push(child);
			if (usedate) {
				this.children.sort(this._cmpDate);
			}else{
				this.children.sort(this._cmpTitle);
			}
		},

		_cmpTitle : function(a,b) {
			var c = a.title.localeCompare(b.title);
			if (c != 0) {
				return c;
			}
			if (a.date == b.date) {
				return 0;
			} else if (a.date < b.date) {
				return  -1;
			} else {
				return 1;
			}
		},

		_cmpDate : function(a,b) {
			if (a.date == b.date) {
				return a.title.localeCompare(b.title);
			} else if (a.date < b.date) {
				return  1;
			} else {
				return -1;
			}
		},
	},

	$.FM4Sender = function() {
		this.content = new CastSource({
			title : "Radio FM4",
			logo : "http://fm4.orf.at/v2static/images/fm4_logo.jpg",
			text : "fm4.ORF.at: Berichte und Kommentare zu Musik, Popkultur, Film, Literatur, Games und Politik.",
			url : "http://mp3stream1.apasf.apa.at:8000/;",
		});
		this.podcast = null;
		this.ondemand = null;
	};


	$.FM4Sender.prototype = {



		getOnDemandShows : [
			'4HOPWed',
			'4ULMon',
			'4ULTue',
			'4ULWed',
			'4ULThu',
			'4ULFri',
			'4SSUSun',
			'4CHSat',
			'4ZSSun',
			'4JZFri',
			'4DDSat',
			'4ISSun',
			'4HEMon',
			'4HSTue',
			'4TVThe',
			'4SHFri',
			'4GLSun',
			'4PHTue',
			'4CZWed',
			'4BTThu',
			'4PXFri',
			'4LBFri',
			'4SSSat',
			'4LRMon',
			'4DKMSun',
			'4SOPMon',
			// '4UTAMon' ,
			// '4UTATue' ,
			// '4UTAWed' ,
			// '4UTAThu' ,
			// '4UTAFris' ,
			// '4DZWed' ,
		],

		getPodcasts : [
			"http://static.orf.at/podcast/fm4/fm4_interview_podcast.xml",
			"http://static.orf.at/podcast/fm4/FM4_Webtip.xml",
			"http://static.orf.at/podcast/fm4/fm4_reality_check_podcast.xml",
			"http://static.orf.at/podcast/fm4/fm4_musikerziehung.xml",
			"http://static.orf.at/podcast/fm4/fm4_ombudsmann.xml",
			"http://static.orf.at/podcast/fm4/fm4_science_busters.xml",
			"http://static.orf.at/podcast/fm4/FM4_Mit_Akzent.xml",
			"http://static.orf.at/podcast/fm4/FM4_Johanna_gefaellt_das_nicht.xml",
			"http://static.orf.at/podcast/fm4/fm4_projekt_x.xml",
			"http://static.orf.at/podcast/fm4/fm4_chez_hermes_extrawurscht.xml",
			//"http://static.orf.at/fm4/podcast/soundpark.xml",
			//"http://static.orf.at/fm4/podcast/fm4_comedy.xml",
		],

		getPodcastInfo : function(podcast, clear) {
			var that = this;
			if (this.podcast == null || clear) {
				this.podcast = new CastSource({
					title: "Podcasts"
				});
				this.content.addChild(this.podcast);
			}
			var pods = podcast;
			if (!(pods instanceof Array)) {
				pods = [pods];
			}
			this.pcToFetch = pods.length;
			$.each(pods, function(idx, val) {
				var url = "//ajax.googleapis.com/ajax/services/feed/load?v=1.0&output=xml&q=" + val;
				$.ajax({
					url : url,
					dataType : 'jsonp',
					cache : false,
					success : $.proxy(that._onPodcastInfo, that),
					error : function() { that.pcToFetch--; },
				});
			});
		},

		_onPodcastInfo : function(response) {
			var feed = $(response.responseData.xmlString);
			var pod = new CastSource({
				title : $("channel>title", feed).text(),
				text : $("channel>description", feed).text(),
			});
			$.each($("channel>item", feed), function(idx, val) {
				var itm = new CastSource({
					title : $("title", val).text(),
					url : $("enclosure", val).attr("url"),
					text :  $("description", val).text(),
					logo : $("itunes\\:image").attr("href"),
					date : moment($("pubdate", val).text()),
				});
				pod.addChild(itm, true);
			});
			this.podcast.addChild(pod);
			this.pcToFetch--;
			if (this.pcToFetch <= 0) {
				$(this).trigger("sender-new-content", this.content);
			}
		},

		getOnDemandInfo : function( key, clear ) {
			var that = this;
			if (this.ondemand == null || clear) {
				this.ondemand = new CastSource({
					title: "On Demand",
				});
				this.content.addChild(this.ondemand);
			}
			var showurl = '//audioapi.orf.at/fm4/json/2.0/playlist/' + key;
			$.ajax({
				url : showurl,
				dataType : 'jsonp',
				cache : false,
				success : $.proxy(that._onDemandInfo, that)
			});
		},

		_onDemandInfo : function( response ) {
			var that = this;
			var url = "http://loopstream01.apa.at/?channel=fm4&ua=flash&id=";
			var data = response.data;
			if (!(data instanceof Array)) {
				data = [data];
			}
			$.each(data, function(idx, val) {
				var description = "";
				if (val.subtitle) {
					description += val.subtitle + '\n';
				}

				if (val.description) {
					description += val.description;
				}
				var sendung = new CastSource({
					title : val.title,
					text : description,
					date : moment(val.dateISO),
				});
				that.ondemand.addChild(sendung);
				$.each(val.streams, function(sidx, sval) {
					var time = moment(sval.startISO).format("HH:mm") + " - " +
						moment(sval.endISO).format("HH:mm");
					var stream = new CastSource({
						title : time,
						date : moment(sval.startISO),
						url : sval.loopStreamId,
					});
					sendung.addChild(stream);
				});
			});
			$(this).trigger("sender-new-content", this.content);
		},

	};

}(jQuery));


// helper function
if (!String.prototype.format) {
	String.prototype.format = String.prototype.f = function() {
		var s = this,
		i = arguments.length;

		while (i--) {
			s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
		}
		return s;
	};
}