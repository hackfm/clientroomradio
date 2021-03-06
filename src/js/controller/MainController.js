"use strict";

this.MainController = function($scope, $document, $log, $window,
                                $location, socket, notificationManager) {
  $scope.config = null;
  $scope.currentTrack = {};
  $scope.users = {};
  $scope.skippers = [];
  $scope.skipLimit = 0;
  $scope.currentPositionInTrack = 0;
  $scope.loved = false;
  $scope.skipped = false;
  $scope.muted = false;
  $scope.bingo = false;
  $scope.state = "loading";

  $scope.login = function() {
    $window.location.href = "http://www.last.fm/api/auth/?api_key=" + $scope.config.apiKey + "&cb=" + $location.protocol() + "://" + $location.host() + "/login.html";
  };

  var logout = function() {
    // clear our session so a refresh won't log them back in
    $.cookie("session", "");

    if ($scope.config) {
      // clear the config so they think they're logged out
      $scope.config.username = null;
      $scope.config.active = false;
      $scope.config.allowed = false;
    }
    // clear everything else just in case
    $scope.loved = false;
    $scope.skipped = false;
    $scope.muted = false;
    $scope.bingo = false;
    $scope.$apply();
  };

  $scope.logout = function() {
    // they clicked logout so tell the backend
    socket.logout();
  };

  socket.disconnectedCallback.add(function() {
    logout();
  });

  $scope.love = function() {
    $scope.loved = true;
    socket.love();
  };

  $scope.unlove = function() {
    $scope.loved = false;
    socket.unlove();
  };

  $scope.isLoggedIn = function() {
    return $scope.config &&
           $scope.config.username !== null &&
           $scope.config.allowed;
  };

  $scope.isPlaying = function() {
    return $scope.currentTrack.artists;
  };

  $scope.isActive = function() {
    return $scope.config ? $scope.config.active : false;
  };

  $scope.isScrobbling = function() {
    return $scope.config ? $scope.config.scrobbling : false;
  };

  $scope.skip = function(message) {
    angular.element(".btn-skip").tooltip("hide");
    socket.sendSkip(message);
  };

  $scope.setScrobbling = function(value) {
    $scope.config.scrobbling = value;
    socket.sendScrobbleStatus(value);
  };

  $scope.setActive = function(value) {
    $scope.config.active = value;
    socket.sendActiveStatus(value);
  };

  // Some helper functions
  $scope.getRadioName = function() {
    return $scope.config ? $scope.config.radioname : "Client Room Radio";
  };

  $scope.getState = function() {
    return $scope.state;
  };

  $scope.getActiveUserCount = function() {
    var count = 0;
    Object.keys($scope.users).forEach(function(username) {
      if ($scope.users[username].active && $scope.users[username].allowed) {
        count++;
      }
    });
    return count;
  };

  $scope.requestNotificationPermissions = function() {
    notificationManager.request();
  };

  $scope.NotificationPermissionNeeded = function() {
    return notificationManager.permissionNeeded();
  };

  $scope.endOfDayRequest = function() {
    socket.endOfDayRequest();
  };

  $document.ready(function() {
    var volume = $.cookie("volume");
    if (angular.isUndefined(volume)) {
      volume = 1;
    }

    var state = "stopped";

    var restart = function(player) {
      state = "starting";

      player.jPlayer("setMedia", {
        mp3: "/stream.mp3"
      });
      player.jPlayer("play");
    };

    angular.element("#audio-player").jPlayer({
      playing: function(event) {
        $log.log("started", event);
        state = "playing";
      },
      ended: function(event) {
        $log.log("ended", event);
        state = "stopped";
      },
      error: function(error) {
        $log.log("there was an error", error);
        state = "stopped";
      },
      ready: function() {
        var player = angular.element(this);
        restart(player);

        var updateMute = function() {
          if ($scope.muted ||
                !$scope.config ||
                !$scope.config.active ||
                !$scope.config.allowed) {
            // muted
            state = "muted";
            player.jPlayer("clearMedia");
          } else {
            // restart playback
            $log.log("restarting audio");
            restart(player);
          }
        };

        var checkPlaying = function(time) {
          if (time !== 0 && state === "stopped") {
            restart(player);
          }
        };

        $scope.$watch("muted", updateMute);
        $scope.$watch("config.active", updateMute);
        $scope.$watch("config.allowed", updateMute);
        $scope.$watch("currentPositionInTrack", checkPlaying);

        angular.element(".volume-slider-init").on("slide", function(ev) {
          volume = 1 - ev.value;
          $log.log(volume);
          $.cookie("volume", volume);
          player.jPlayer("volume", volume);
        });

        player.jPlayer("volume", volume);
      },
      swfPath: "/js",
      supplied: "mp3"
    });

    var sliderInit = angular.element(".volume-slider-init");
    if (sliderInit.length !== 0) {
      sliderInit.slider().slider("setValue", 1 - volume);
    }
  });

  $scope.toggleMuted = function() {
    $scope.muted = !$scope.muted;
    socket.sendMutedStatus($scope.muted);
  };

  $scope.clickOnVolumeBar = function(e) {
    var event = e || $window.event;
    $log.log(event);
    event.stopPropagation();

    $scope.muted = false;
    socket.sendMutedStatus(false);
  };

  // Update progress bar
  $scope.progressValueNow = function() {
    return $scope.currentPositionInTrack * 100;
  };

  $scope.progressBarStyle = function() {
    return {
      width: $scope.progressValueNow() + "%"
    };
  };

  $scope.durationInText = function() {
    var duration = $scope.currentTrack.duration || 0;
    var totalSeconds = Math.round(duration / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var remainder = String(totalSeconds % 60);

    remainder = "00".substring(0, 2 - remainder.length) + remainder;
    return minutes + ":" + remainder;
  };

  socket.readyStateCallback.add(function(data) {
    $log.log("ready state changed", data);

    // ignore open and connecting in the loading state
    // in this case we wait until we've recieved our first config
    switch (data) {
      case SockJS.OPEN:
        $scope.state = "open";
        break;
      case SockJS.CONNECTING:
        $scope.state = "connecting";
        break;
      case SockJS.CLOSING:
      case SockJS.CLOSED:
      default:
        $scope.state = "offline";
        break;
    }

    $scope.$apply();
  });

  socket.configCallback.add(function(data) {
    $scope.config = data;
    $scope.$apply();
  });

  socket.newTrackCallback.add(function(data) {
    $scope.currentTrack = data;

    $scope.loved = false;
    if (data.context &&
        angular.isDefined(data.context[$scope.config.username]) &&
        data.context[$scope.config.username].userloved === "1") {
      $scope.loved = true;
    }

    $scope.bingo = data.bingo;

    $scope.$apply();
  });

  socket.bingoCallback.add(function(bingo) {
    $scope.bingo = bingo;
    $scope.$apply();
  });

  socket.progressCallback.add(function(progress) {
    $scope.currentPositionInTrack = progress;
    $scope.$apply();
  });

  socket.usersCallback.add(function(data) {
    $scope.users = data;
    $scope.$apply();
  });

  socket.skippersCallback.add(function(data) {
    $scope.skippers = data.skippers;
    $scope.skipLimit = data.skipLimit;
    $scope.skipped = false;

    $scope.skippers.forEach(function(skipper) {
      if (skipper === $scope.config.username) {
        $scope.skipped = true;
      }
    });
    $scope.$apply();
  });

  socket.sysCallback.add(function(data) {
    if (data.type === "skip") {
      $scope.skipped = true;
      $scope.$apply();
    }
  });
};
