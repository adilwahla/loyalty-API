document.addEventListener("DOMContentLoaded", function () {
    function fixVideos() {
        var videos = document.querySelectorAll("video");
        for (var i = 0; i < videos.length; i++) {
            var v = videos[i];
            v.setAttribute("playsinline", "");
            v.setAttribute("webkit-playsinline", "");
            v.setAttribute("muted", "");
            v.muted = true;
            v.autoplay = true;
            v.loop = true;
            try {
                var p = v.play();
                if (p && p.catch) {
                    p.catch(function(){});
                }
            } catch(e) {}
        }
    }
    fixVideos();
    setTimeout(fixVideos, 500);
    setTimeout(fixVideos, 1500);
    document.addEventListener("touchstart", function () {
        fixVideos();
    }, { once: true });
});
