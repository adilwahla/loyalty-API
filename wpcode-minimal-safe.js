function fixVideos() {
    var videos = document.querySelectorAll("video");
    var i;
    for (i = 0; i < videos.length; i++) {
        videos[i].setAttribute("playsinline", "");
        videos[i].setAttribute("webkit-playsinline", "");
        videos[i].setAttribute("muted", "");
        videos[i].muted = true;
        try {
            videos[i].play();
        } catch(e) {}
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixVideos);
} else {
    fixVideos();
}

setTimeout(fixVideos, 500);
setTimeout(fixVideos, 1500);

document.addEventListener("touchstart", fixVideos);
