(function(){

  window.embetter = {};
  var embetter = window.embetter;

  /////////////////////////////////////////////////////////////
  // COMMON UTIL HELPERS
  /////////////////////////////////////////////////////////////

  embetter.debug = true;
  embetter.curEmbeds = [];
  embetter.mobileScrollTimeout = null;
  embetter.mobileScrollSetup = false;

  embetter.utils = {
    /////////////////////////////////////////////////////////////
    // REGEX HELPERS
    /////////////////////////////////////////////////////////////
    buildRegex: function(regexStr) {
      var optionalPrefix = '(?:https?:\\/\\/)?(?:w{3}\\.)?';
      var terminator = '(?:\\/?|$|\\s|\\?|#)';
      return new RegExp(optionalPrefix + regexStr + terminator);
    },
    /////////////////////////////////////////////////////////////
    // BUILD HTML TEMPLATES
    /////////////////////////////////////////////////////////////
    stringToDomElement: function(str) {
      var div = document.createElement('div');
      div.innerHTML = str;
      return div.firstChild;
    },
    playerHTML: function(service, mediaUrl, thumbnail, id) {
      return '<div class="embetter" ' + service.dataAttribute + '="' + id + '">\
          <a href="' + mediaUrl + '" target="_blank"><img src="' + thumbnail + '"></a>\
        </div>';
    },
    playerCode: function(htmlStr) {
      var entityMap = {
        "<": "&lt;",
        ">": "&gt;",
      };
      function escapeHtml(string) {
        return String(string).replace(/[<>]/g, function (s) {
          return entityMap[s];
        });
      }
      htmlStr = htmlStr.replace(/\>\s+\</g,'><'); // remove whitespace between tags
      return '<p>Embed code:<textarea class="u-full-width">' + escapeHtml(htmlStr) + '</textarea></p>';
    },
    embedPlayerInContainer: function(containerEl, serviceObj, mediaUrl, thumbnail, id) {
        // create service title
        containerEl.appendChild(embetter.utils.stringToDomElement('<h3>' + serviceObj.type.toUpperCase() + '</h3>'));
        // create embed
        var newEmbedHTML = embetter.utils.playerHTML(serviceObj, mediaUrl, thumbnail, id);
        var newEmbedEl = embetter.utils.stringToDomElement(newEmbedHTML);
        embetter.utils.initPlayer(newEmbedEl, serviceObj, embetter.curEmbeds);
        containerEl.appendChild(newEmbedEl);
        // show embed code
        var newEmbedCode = embetter.utils.playerCode(newEmbedHTML);
        var newEmbedCodeEl = embetter.utils.stringToDomElement(newEmbedCode);
        containerEl.appendChild(newEmbedCodeEl);
    },
    /////////////////////////////////////////////////////////////
    // MEDIA PLAYERS PAGE MANAGEMENT
    /////////////////////////////////////////////////////////////
    initMediaPlayers: function(el, services) {
      for (var i = 0; i < services.length; i++) {
        var service = services[i];
        var serviceEmbedContainers = el.querySelectorAll('div['+service.dataAttribute+']');
        for(var j=0; j < serviceEmbedContainers.length; j++) {
          embetter.utils.initPlayer(serviceEmbedContainers[j], service);
        }
      }
      // handle mobile auto-embed on scroll
      if(navigator.userAgent.toLowerCase().match(/iphone|ipad|ipod|android/) && embetter.mobileScrollSetup == false) {
        window.addEventListener('scroll', embetter.utils.scrollListener);
        embetter.mobileScrollSetup = true;
        // force scroll to trigger listener on page load
        window.scroll(window.scrollX, window.scrollY+1);
        window.scroll(window.scrollX, window.scrollY-1);
      };
    },
    scrollListener: function() {
      // throttled scroll listener
      if(embetter.mobileScrollTimeout != null) {
        window.clearTimeout(embetter.mobileScrollTimeout);
      }
      // check to see if embeds are on screen. if so, embed! otherwise, unembed
      // exclude codepen since we don't know what might execute
      embetter.mobileScrollTimeout = setTimeout(function() {
        for (var i = 0; i < embetter.curEmbeds.length; i++) {
          var player = embetter.curEmbeds[i];
          if(player.getType() != 'codepen') {
            var playerRect = player.el.getBoundingClientRect();
            if(playerRect.bottom < window.innerHeight && playerRect.top > 0) {
              player.embedMedia();
            } else {
              player.unembedMedia();
            }
          }
        };
      }, 500);
    },
    initPlayer: function(embedEl, service) {
      if(embedEl.classList.contains('embetter-ready') == true) return;
      if(embedEl.classList.contains('embetter-static') == true) return;
      embetter.curEmbeds.push( new embetter.EmbetterPlayer(embedEl, service) );
    },
    unembedPlayers: function(containerEl) {
      for (var i = 0; i < embetter.curEmbeds.length; i++) {
        if(containerEl && containerEl.contains(embetter.curEmbeds[i].el)) {
          embetter.curEmbeds[i].unembedMedia();
        }
      };
    },
    disposePlayers: function() {
      for (var i = 0; i < embetter.curEmbeds.length; i++) {
        embetter.curEmbeds[i].dispose();
      };
      window.removeEventListener('scroll', embetter.utils.scrollListener);
      embetter.mobileScrollSetup = false;
      embetter.curEmbeds.splice(0, embetter.curEmbeds.length-1);
    },
    disposeDetachedPlayers: function() {
      // dispose any players no longer in the DOM
      for (var i = embetter.curEmbeds.length - 1; i >= 0; i--) {
        var embed = embetter.curEmbeds[i];
        if(document.body.contains(embed.el) == false || embed.el == null) {
          embed.dispose();
          delete embetter.curEmbeds.splice(i,1);
        }
      };
    },

    /////////////////////////////////////////////////////////////
    // BUILD PLAYER FROM PASTE
    /////////////////////////////////////////////////////////////
    buildPlayerFromServiceURL: function(el, string, services) {
      for (var i = 0; i < services.length; i++) {
        var service = services[i];
        if(string.match(service.regex) != null) {
          service.buildFromText(string, el);
        }
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // 3RD-PARTY SERVICE SUPPORT
  /////////////////////////////////////////////////////////////

  embetter.services = {};

  /////////////////////////////////////////////////////////////
  // YOUTUBE
  // http://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api
  // https://developers.google.com/youtube/iframe_api_reference
  // http://stackoverflow.com/questions/3717115/regular-expression-for-youtube-links
  /////////////////////////////////////////////////////////////
  embetter.services.youtube = {
    type: 'youtube',
    dataAttribute: 'data-youtube-id',
    regex: /(?:.+?)?(?:youtube\.com\/v\/|watch\/|\?v=|\&v=|youtu\.be\/|\/v=|^youtu\.be\/)([a-zA-Z0-9_-]{11})+/,
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '&autoplay=1' : '';
      return '<iframe class="video" width="'+ w +'" height="'+ h +'" src="https://www.youtube.com/embed/'+ id +'?rel=0&suggestedQuality=hd720'+ autoplayQuery +'" frameborder="0" scrolling="no" webkitAllowFullScreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(id) {
      return 'http://img.youtube.com/vi/'+ id +'/0.jpg';
    },
    link: function(id) {
      return 'https://www.youtube.com/watch?v=' + id;
    },
    buildFromText: function(text, containerEl) {
      var videoId = text.match(this.regex)[1];
      if(videoId != null) {
        var videoURL = this.link(videoId);
        var videoThumbnail = this.getData(videoId);
        embetter.utils.embedPlayerInContainer(containerEl, this, videoURL, videoThumbnail, videoId);
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // VIMEO
  // http://lolobobo.fr/poireau/
  /////////////////////////////////////////////////////////////
  embetter.services.vimeo = {
    type: 'vimeo',
    dataAttribute: 'data-vimeo-id',
    regex: embetter.utils.buildRegex('vimeo.com\/(\\S*)'),
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '&amp;autoplay=1' : '';
      return '<iframe src="//player.vimeo.com/video/'+ id +'?title=0&amp;byline=0&amp;portrait=0&amp;color=ffffff'+ autoplayQuery +'" width="'+ w +'" height="'+ h +'" frameborder="0" scrolling="no" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(mediaUrl, callback) {
      var videoId = mediaUrl.split('vimeo.com/')[1];
      window.reqwest({
        url: 'http://vimeo.com/api/v2/video/'+ videoId +'.json',
        type: 'jsonp',
        error: function (err) {},
        success: function (data) {
          callback(data[0].thumbnail_large);
        }
      })

      return '';
    },
    link: function(id) {
      return 'https://vimeo.com/' + id;
    },
    buildFromText: function(text, containerEl) {
      var self = this;
      var videoId = text.match(this.regex)[1];
      if(videoId != null) {
        var videoURL = this.link(videoId);
        this.getData(videoURL, function(videoThumbnail) {
          embetter.utils.embedPlayerInContainer(containerEl, self, videoURL, videoThumbnail, videoId);
        });
      }
    }
  };




  /////////////////////////////////////////////////////////////
  // SOUNDCLOUD
  // https://soundcloud.com/pages/embed
  // https://developers.soundcloud.com/docs/api/sdks
  // http://soundcloud.com/oembed?format=js&url=https%3A//soundcloud.com/cacheflowe/patter&iframe=true
  /////////////////////////////////////////////////////////////
  embetter.services.soundcloud = {
    type: 'soundcloud',
    dataAttribute: 'data-soundcloud-id',
    regex: embetter.utils.buildRegex('(?:soundcloud.com|snd.sc)\\/([a-zA-Z0-9_-]*(?:\\/sets)?(?:\\/groups)?\\/[a-zA-Z0-9_-]*)'),
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '&amp;auto_play=true' : '';
      if(!id.match(/^(playlist|track|group)/)) id = 'tracks/' + id; // if no tracks/sound-id, prepend tracks/ (mostly for legacy compatibility)
      return '<iframe width="100%" height="600" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/'+ id + autoplayQuery +'&amp;hide_related=false&amp;color=373737&amp;show_comments=false&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>';
    },
    getData: function(mediaUrl, callback) {
      reqwest({
        url: 'http://api.soundcloud.com/resolve.json?url='+ mediaUrl +'&client_id=YOUR_CLIENT_ID&callback=jsonpResponse',
        type: 'jsonp',
        error: function (err) {},
        success: function (data) {
          callback(data);
        }
      })
    },
    link: function(id) {
      return 'https://soundcloud.com/' + id;
    },
    largerThumbnail: function(thumbnail) {
      return thumbnail.replace('large.jpg', 't500x500.jpg');
    },
    buildFromText: function(text, containerEl) {
      var self = this;
      var soundURL = this.link(text.match(this.regex)[1]);
      if(soundURL != null) {
        this.getData(soundURL, function(data) {
          // progressively fall back from sound image to user image to group creator image. grab larger image where possible
          var thumbnail = data.artwork_url;
          if(thumbnail) thumbnail = self.largerThumbnail(thumbnail);

          if(thumbnail == null) {
            thumbnail = (data.user) ? data.user.avatar_url : null;
            if(thumbnail) thumbnail = self.largerThumbnail(thumbnail);
          }

          if(thumbnail == null) {
            thumbnail = (data.creator) ? data.creator.avatar_url : null;
            if(thumbnail) thumbnail = self.largerThumbnail(thumbnail);
          }

          if(thumbnail) {
            // handle special soundcloud ids
            var soundId = data.id;
            if(soundURL.indexOf('/sets/') != -1) soundId = 'playlists/' + soundId;
            else if(soundURL.indexOf('/groups/') != -1) soundId = 'groups/' + soundId;
            else soundId = 'tracks/' + soundId;

            // create embed
            embetter.utils.embedPlayerInContainer(containerEl, self, soundURL, thumbnail, soundId);
          }
        });
      }
    }
  };



  /////////////////////////////////////////////////////////////
  // INSTAGRAM
  // http://instagram.com/p/fA9uwTtkSN/media/?size=l
  // https://instagram.com/p/fA9uwTtkSN/embed/
  // http://api.instagram.com/oembed?url=http://instagr.am/p/fA9uwTtkSN/?blah
  /////////////////////////////////////////////////////////////
  embetter.services.instagram = {
    type: 'instagram',
    dataAttribute: 'data-instagram-id',
    regex: embetter.utils.buildRegex('instagram.com\/p\/([a-zA-Z0-9-]*)'),
    embed: function(id, w, h, autoplay) {
      return '<iframe width="100%" height="600" scrolling="no" frameborder="no" src="https://instagram.com/p/'+ id +'/embed/"></iframe>';
    },
    getData: function(id) {
      return 'https://instagram.com/p/' + id +'/media/?size=l';
    },
    link: function(id) {
      return 'https://instagram.com/p/' + id +'/';
    },
    buildFromText: function(text, containerEl) {
      var mediaId = text.match(this.regex)[1];
      var mediaURL = this.link(mediaId);
      if(mediaURL != null) {
        var thumbnail = this.getData(mediaId);
        embetter.utils.embedPlayerInContainer(containerEl, this, mediaURL, thumbnail, mediaId);
      }
    }
  };



  /////////////////////////////////////////////////////////////
  // DAILYMOTION
  /////////////////////////////////////////////////////////////
  embetter.services.dailymotion = {
    type: 'dailymotion',
    dataAttribute: 'data-dailymotion-id',
    regex: embetter.utils.buildRegex('dailymotion.com\/video\/([a-zA-Z0-9-_]*)'),
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '?autoPlay=1' : '';
      return '<iframe class="video" width="'+ w +'" height="'+ h +'" src="//www.dailymotion.com/embed/video/'+ id + autoplayQuery +'" frameborder="0" scrolling="no" webkitAllowFullScreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(id) {
      return 'http://www.dailymotion.com/thumbnail/video/'+ id;
    },
    link: function(id) {
      return 'http://www.dailymotion.com/video/'+ id;
    },
    buildFromText: function(text, containerEl) {
      text = text.split('_')[0];
      var videoId = text.match(this.regex)[1];
      if(videoId != null) {
        var videoURL = this.link(videoId);
        var videoThumbnail = this.getData(videoId);
        embetter.utils.embedPlayerInContainer(containerEl, this, videoURL, videoThumbnail, videoId);
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // RDIO
  /////////////////////////////////////////////////////////////
  embetter.services.rdio = {
    type: 'rdio',
    dataAttribute: 'data-rdio-id',
    regex: embetter.utils.buildRegex('rdio.com\/(\\S*)'),
    embed: function(id, w, h, autoplay) {
      // var autoplayQuery = (autoplay == true) ? '?autoplay=' : '';
      var autoplayQuery = '';
      return '<iframe width="100%" height="400" src="https://rd.io/i/'+ id + '/' + autoplayQuery +'" frameborder="0" scrolling="no"></iframe>';
    },
    getData: function(mediaUrl, callback) {
      window.reqwest({
        url: 'http://www.rdio.com/api/oembed/?format=json&url='+ mediaUrl,
        type: 'jsonp',
        error: function (err) {},
        success: function (data) {
          callback(data);
        }
      })
    },
    link: function(path) {
      return 'http://www.rdio.com/' + path;
    },
    buildFromText: function(text, containerEl) {
      var self = this;
      var soundURL = text; // this.link(text.match(this.regex)[1]);
      if(soundURL != null) {
        this.getData(soundURL, function(data) {
          var soundId = data.html.match(/https:\/\/rd.io\/i\/(\S*)\//)[1];
          if(data.thumbnail_url && soundId) {
            embetter.utils.embedPlayerInContainer(containerEl, self, soundURL, data.thumbnail_url, soundId);
          }
        });
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // MIXCLOUD
  /////////////////////////////////////////////////////////////
  embetter.services.mixcloud = {
    type: 'mixcloud',
    dataAttribute: 'data-mixcloud-id',
    regex: embetter.utils.buildRegex('(?:mixcloud.com)\\/(.*\\/.*)'),
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '&amp;autoplay=true' : '';
      return '<iframe width="660" height="180" src="https://www.mixcloud.com/widget/iframe/?feed=' + window.escape('http://www.mixcloud.com/' + id) + '&amp;replace=0&amp;hide_cover=1&amp;stylecolor=ffffff&amp;embed_type=widget_standard&amp;'+ autoplayQuery +'" frameborder="0" scrolling="no"></iframe>';
    },
    getData: function(mediaUrl, callback) {
      window.reqwest({
        url: 'http://www.mixcloud.com/oembed/?url='+ mediaUrl +'&format=jsonp',
        type: 'jsonp',
        error: function (err) {},
        success: function (data) {
          callback(data);
        }
      });
    },
    link: function(id) {
      return 'https://www.mixcloud.com/' + id;
    },
    buildFromText: function(text, containerEl) {
      var self = this;
      var soundId = text.match(this.regex)[1];
      var soundURL = this.link(soundId);
      if(soundURL != null) {
        this.getData(soundURL, function(data) {
          if(data.image) {
            embetter.utils.embedPlayerInContainer(containerEl, self, soundURL, data.image, soundId);
          }
        });
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // CODEPEN
  /////////////////////////////////////////////////////////////
  embetter.services.codepen = {
    type: 'codepen',
    dataAttribute: 'data-codepen-id',
    regex: embetter.utils.buildRegex('(?:codepen.io)\\/([a-zA-Z0-9_\\-%]*\\/[a-zA-Z0-9_\\-%]*\\/[a-zA-Z0-9_\\-%]*)'),
    embed: function(id, w, h, autoplay) {
     id = id.replace('/pen/', '/embed/');
     var user = id.split('/')[0];
     var slugHash = id.split('/')[2];
     return '<iframe src="//codepen.io/' + id + '?height=' + h + '&amp;theme-id=0&amp;slug-hash=' + slugHash + '&amp;default-tab=result&amp;user=' + user + '" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen="true"></iframe>';
    },
    getData: function(id) {
      return 'http://codepen.io/' + id + '/image/large.png';
    },
    link: function(id) {
      return 'http://codepen.io/' + id;
    },
    buildFromText: function(text, containerEl) {
      var penId = text.match(this.regex)[1];
      if(penId != null) {
        var penURL = this.link(penId);
        var penThumbnail = this.getData(penId);
        embetter.utils.embedPlayerInContainer(containerEl, this, penURL, penThumbnail, penId);
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // BANDCAMP
  // https://swindleuk.bandcamp.com/album/swindle-walters-call
  // <meta property="twitter:player" content="https://bandcamp.com/EmbeddedPlayer/v=2/album=2659930103/size=large/linkcol=0084B4/notracklist=true/twittercard=true/" />
  // <link rel="image_src" href="https://f1.bcbits.com/img/a0883249002_16.jpg">
  // <meta property="og:image" content="https://f1.bcbits.com/img/a0883249002_16.jpg">
  // <meta property="twitter:player" content="https://bandcamp.com/EmbeddedPlayer/v=2/track=1572756071/size=large/linkcol=0084B4/notracklist=true/twittercard=true/" />
  // <meta property="twitter:image" content="https://f1.bcbits.com/img/a0883249002_2.jpg" />
  // https://f1.bcbits.com/img/a0883249002_16.jpg
  /////////////////////////////////////////////////////////////
  embetter.services.bandcamp = {
    type: 'bandcamp',
    dataAttribute: 'data-bandcamp-id',
    regex: embetter.utils.buildRegex('([a-zA-Z0-9_\\-]*.bandcamp.com\\/(album|track)\\/[a-zA-Z0-9_\\-%]*)'),
    embed: function(id, w, h, autoplay) {
      return '<iframe src="https://bandcamp.com/EmbeddedPlayer/' + id + '/size=large/bgcol=ffffff/linkcol=333333/tracklist=true/artwork=small/transparent=true/" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen="true" seamless></iframe>';
    },
    link: function(id) {
      return 'https://'+id;
    },
    buildFromText: function(text, containerEl) {
      console.warn('Bandcamp embeds don\'t work without an opengraph metatag scraper. Hardcoded values will be used.');
      var bandcampId = text.match(this.regex)[1];
      if(bandcampId != null) {
        var soundURL = this.link(bandcampId);
        var soundThumbnail = 'https://f1.bcbits.com/img/a0883249002_16.jpg';
        embetter.utils.embedPlayerInContainer(containerEl, this, soundURL, soundThumbnail, 'album=2659930103');
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // USTREAM
  // https://ustream.zendesk.com/entries/52568684-Using-URL-Parameters-and-the-Ustream-Embed-API-for-Custom-Players
  // http://www.ustream.tv/recorded/*
  // http://www.ustream.tv/*
  // http://ustre.am/*
  /////////////////////////////////////////////////////////////
  embetter.services.ustream = {
    type: 'ustream',
    dataAttribute: 'data-ustream-id',
    regex: embetter.utils.buildRegex('(?:ustream.tv|ustre.am)\\/((?:(recorded|channel)\\/)?[a-zA-Z0-9_\\-%]*)'),
    embed: function(id, w, h, autoplay) {
      var autoplayQuery = (autoplay == true) ? '&amp;autoplay=true' : '';      
      return '<iframe width="480" height="300" src="https://www.ustream.tv/embed/' + id + '?v=3&amp;wmode=direct' + autoplayQuery + '" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen="true"></iframe>';
    },
    link: function(id) {
      return 'http://www.ustream.tv/'+id;
    },
    getData: function(mediaUrl, callback) {
      window.reqwest({
        url: 'http://localhost/embetter/vendor/proxy.php?csurl=' + 'http://www.ustream.tv/oembed?url='+ mediaUrl,
        type: 'json',
        error: function (err) {},
        success: function (data) {
          callback(data);
        }
      })
    },
    buildFromText: function(text, containerEl) {
      var self = this;
      var streamId = text.match(this.regex)[1];
      var streamURL = this.link(streamId);
      if(streamURL != null) {
        this.getData(streamURL, function(data) {
          if(data.thumbnail_url) {
            var channelId = data.html.match(/cid=([0-9]*)/);
            streamId = (channelId) ? channelId[1] : streamId;
            embetter.utils.embedPlayerInContainer(containerEl, self, streamURL, data.thumbnail_url, streamId);
          }
        });
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // IMGUR
  // look at this URL: http://imgur.com/gallery/u063r and remove "gallery/" to get a completely different embed
  // http://api.imgur.com/oembed.json?url=http://imgur.com/gallery/u063r
  // look for: <meta name="twitter:card" content="gallery"/> - this lets us prepend "a/" before id to get the gallery embed
  // gallery mode indicator: <meta name="twitter:card" content="gallery"/>
  // gallery embed id: a/u063r
  // gallery embed thumb: first og:image
  // image embed id: u063r
  // image embed thumb: u063r
  /////////////////////////////////////////////////////////////
  embetter.services.imgur = {
    type: 'imgur',
    dataAttribute: 'data-imgur-id',
    regex: embetter.utils.buildRegex('(?:imgur.com)\\/((?:gallery\\/)?[a-zA-Z0-9_\\-%]*)'),
    embed: function(id, w, h, autoplay) {
      return '<iframe width="'+ w +'" height="'+ h +'" src="https://www.imgur.com/'+ id +'/embed" " frameborder="0" webkitAllowFullScreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(mediaUrl, callback) {
      window.reqwest({
        url: 'http://localhost/embetter/vendor/proxy.php?csurl=' + 'http://api.imgur.com/oembed.json?url='+ mediaUrl,
        type: 'json',
        error: function (err) {
          console.log('imgur error', err);
        },
        success: function (data) {
          callback(data);
        }
      });
    },
    getThumbnail: function(id) {
      return 'https://i.imgur.com/'+ id +'m.jpg';
    },
    link: function(id) {
      return 'https://imgur.com/' + id;
    },
    buildFromText: function(text, containerEl) {
      var imgId = text.match(this.regex)[1];
      imgId = imgId.replace('gallery/', ''); // for testing, don't deal with galleries
      if(imgId != null) {
        /*
        // don't really need the endpoint, since oembed doesn't give us the gallery embed code *and* a thumbnail. we need to scrape og tags and check for gallery, then prepend "/a/" before the image ID embed 
        var self = this;
        // build embed
        var mediaURL = this.link(imgId);
        this.getData(mediaURL, function(data) {
          var imgId = data.html.match(/data-id="([a-zA-Z0-9\-\/]*)/)[1];
          var thumbnail = self.getThumbnail(imgId);
          if(thumbnail) {
            var imgURL = self.link(imgId);            
            embetter.utils.embedPlayerInContainer(containerEl, self, imgURL, thumbnail, imgId);
          }
        });
        */
        var mediaURL = this.link(imgId);
        var thumbnail = this.getThumbnail(imgId);
        embetter.utils.embedPlayerInContainer(containerEl, this, mediaURL, thumbnail, imgId);
      }
    }
  };
  
  
  /////////////////////////////////////////////////////////////
  // VINE
  /////////////////////////////////////////////////////////////
  embetter.services.vine = {
    type: 'vine',
    dataAttribute: 'data-vine-id',
    regex: embetter.utils.buildRegex('vine.co\\/v\\/([a-zA-Z0-9-]*)'),
    embed: function(id, w, h, autoplay) {
      return '<iframe width="'+ w +'" height="'+ h +'" src="https://vine.co/v/'+ id +'/card?mute=1" " frameborder="0" webkitAllowFullScreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(imgId, callback) {
      window.reqwest({
        url: 'http://localhost/embetter/vendor/proxy.php?csurl=' + 'https://vine.co/oembed/' + imgId + '.json',
        type: 'json',
        error: function (err) {
          console.log('imgur error', err);
        },
        success: function (data) {
          callback(data);
        }
      });
    },
    link: function(id) {
      return 'https://vine.co/v/' + id;
    },
    buildFromText: function(text, containerEl) {
      var videoId = text.match(this.regex)[1];
      if(videoId != null) {
        var self = this;
        this.getData(videoId, function(data) {
          if(data.thumbnail_url) {
            var vineURL = self.link(videoId);            
            embetter.utils.embedPlayerInContainer(containerEl, self, vineURL, data.thumbnail_url, videoId);
          }
        });
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // SLIDESHARE
  // http://www.slideshare.net/developers/oembed
  // http://www.slideshare.net/api/oembed/2?url=http://www.slideshare.net/tedxseoul/the-inaugural-tedxseoul-teaser&format=json
  /////////////////////////////////////////////////////////////
  embetter.services.slideshare = {
    type: 'slideshare',
    dataAttribute: 'data-slideshare-id',
    regex: embetter.utils.buildRegex('slideshare.net\\/([a-zA-Z0-9_\\-%]*\\/[a-zA-Z0-9_\\-%]*)'),
    embed: function(id, w, h, autoplay) {
      return '<iframe width="427" height="356" src="https://www.slideshare.net/slideshow/embed_code/key/'+ id + '" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowfullscreen></iframe>';
    },
    getData: function(imgId, callback) {
      window.reqwest({
        url: 'http://localhost/embetter/vendor/proxy.php?csurl=' + 'http://www.slideshare.net/api/oembed/2?url=https://www.slideshare.net/' + imgId + '&format=json',
        type: 'json',
        error: function (err) {},
        success: function (data) {
          callback(data);
        }
      });
    },
    link: function(id) {
      return 'https://www.slideshare.net/' + id;
    },
    buildFromText: function(text, containerEl) {
      var videoId = text.match(this.regex)[1];
      if(videoId != null) {
        var self = this;
        this.getData(videoId, function(data) {
          if(data.thumbnail) {
            var imgId = data.html.match(/embed_code\/key\/([a-zA-Z0-9\-\/]*)/)[1];
            var slideshareURL = self.link(videoId);            
            embetter.utils.embedPlayerInContainer(containerEl, self, slideshareURL, data.thumbnail, imgId);
          }
        });
      }
    }
  };


  /////////////////////////////////////////////////////////////
  // MEDIA PLAYER INSTANCE
  /////////////////////////////////////////////////////////////

  embetter.curPlayer = null;

  embetter.EmbetterPlayer = function(el, serviceObj) {
    this.el = el;
    this.el.classList.add('embetter-ready');
    this.serviceObj = serviceObj;
    this.id = this.el.getAttribute(serviceObj.dataAttribute);
    this.thumbnail = this.el.querySelector('img');
    this.playerEl = null;
    this.buildPlayButton();
    this.checkForBadThumbnail();
  };

  embetter.EmbetterPlayer.prototype.buildPlayButton = function() {
    this.playButton = document.createElement('div');
    this.playButton.classList.add('embetter-loading');
    this.el.appendChild(this.playButton);

    this.playButton = document.createElement('div');
    this.playButton.classList.add('embetter-play-button');
    this.el.appendChild(this.playButton);

    var self = this;
    this.playHandler = function() { self.play(); }; // for event listener removal
    this.playButton.addEventListener('click', this.playHandler);
  };
  
  embetter.EmbetterPlayer.prototype.checkForBadThumbnail = function() {
    var self = this;
    // try to detect onerror
    this.thumbnail.onerror = function() {
      self.fallbackThumbnail();
    };
    // if onerror already happened but we still have a broken image, give it 4 seconds to load, then replace
    setTimeout(function() {
      if(self.thumbnail.height < 50) {
        self.fallbackThumbnail();
      }
    }, 4000);
  };
  
  embetter.EmbetterPlayer.prototype.fallbackThumbnail = function() {
    this.thumbnail.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAArwAAAGcAQMAAAABMOGrAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAADUExURQAAAKd6PdoAAAA6SURBVHja7cGBAAAAAMOg+VPf4ARVAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAN488AAGP4e1mAAAAAElFTkSuQmCC';
  };

  embetter.EmbetterPlayer.prototype.getType = function() {
    return this.serviceObj.type;
  };

  embetter.EmbetterPlayer.prototype.play = function() {
    if(embetter.curPlayer != null) {
      embetter.curPlayer.unembedMedia();
      embetter.curPlayer = null;
    }

    if(this.id != null) this.playerEl = embetter.utils.stringToDomElement(this.serviceObj.embed(this.id, this.thumbnail.width, this.thumbnail.height, true));
    this.el.appendChild(this.playerEl);
    this.el.classList.add('embetter-playing');
    embetter.curPlayer = this;
  };

  embetter.EmbetterPlayer.prototype.unembedMedia = function() {
    if(this.playerEl != null && this.playerEl.parentNode != null) {
      this.playerEl.parentNode.removeChild(this.playerEl);
    }
    this.el.classList.remove('embetter-playing');
  };

  // embed if mobile
  embetter.EmbetterPlayer.prototype.embedMedia = function() {
    if(this.el.classList.contains('embetter-playing') == true) return;
    if(this.id != null) this.playerEl = embetter.utils.stringToDomElement(this.serviceObj.embed(this.id, this.thumbnail.width, this.thumbnail.height, false));
    this.el.appendChild(this.playerEl);
    this.el.classList.add('embetter-playing');
  };

  embetter.EmbetterPlayer.prototype.dispose = function() {
    this.el.classList.remove('embetter-ready');
    this.unembedMedia();
    this.playButton.removeEventListener('click', this.playHandler);
    if(this.playButton != null && this.playButton.parentNode != null) {
      this.playButton.parentNode.removeChild(this.playButton);
    }
  };
})();