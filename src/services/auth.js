function _loadFbSDK() {
    return new Promise(resolve => {
        if (window.FB) return resolve(window.FB);

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: '617666711907990',
                cookie: true,
                xfbml: true,
                version: 'v3.0'
            });

            window.FB.AppEvents.logPageView();

            resolve(window.FB);
        };

        (function (d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {
                return;
            }
            js = d.createElement(s);
            js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    })
}

function _loadGoogleSDK() {
    return new Promise(resolve => {
        if (window.GOOGLE) return resolve(window.GOOGLE);

        (function (d, s, id, cb) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {
                return;
            }
            js = d.createElement(s);
            js.id = id;
            js.defer = true;
            js.async = true;
            js.src = "https://apis.google.com/js/platform.js";
            fjs.parentNode.insertBefore(js, fjs);

            js.onload = cb;
        }(document, 'script', 'google-jssdk', () => {
            window.gapi.load('auth2', function () {
                window.GOOGLE = window.gapi.auth2;

                resolve(window.GOOGLE);
            });
        }))
    });
}

export var loadFbSDK = _loadFbSDK;
export var loadGoogleSDK = _loadGoogleSDK;