define([
    'jquery',
    '/bower_components/hyperjson/hyperjson.js',
    'json.sortify',
    '/drive/tests.js',
    '/common/test.js',
    '/common/common-hash.js',
    '/common/common-util.js',
    '/common/common-thumbnail.js',
    '/common/wire.js',
    '/common/flat-dom.js',
], function ($, Hyperjson, Sortify, Drive, Test, Hash, Util, Thumb, Wire, Flat) {
    window.Hyperjson = Hyperjson;
    window.Sortify = Sortify;

    var assertions = 0;
    var failed = false;
    var failedOn;
    var failMessages = [];

    var ASSERTS = [];
    var runASSERTS = function (cb) {
        var count = ASSERTS.length;
        var successes = 0;

        var done = function (err) {
            count--;
            if (err) { failMessages.push(err); }
            else { successes++; }
            if (count === 0) { cb(); }
        };

        ASSERTS.forEach(function (f, index) {
            f(function (err) {
                //console.log("test " + index);
                done(err, index);
            }, index);
        });
    };

    var assert = function (test, msg) {
        ASSERTS.push(function (cb, i) {
            test(function (result) {
                if (result === true) {
                    assertions++;
                    cb();
                } else {
                    failed = true;
                    failedOn = assertions;
                    cb({
                        test: i,
                        message: msg,
                        output: result,
                    });
                }
            });
        });
    };

    var HJSON_list = [
        '["DIV",{"id":"target"},[["P",{"class":" alice bob charlie has.dot","id":"bang"},["pewpewpew"]]]]',

        '["DIV",{"id":"quot"},[["P",{},["\\"pewpewpew\\""]]]]',

        '["DIV",{"id":"widget"},[["DIV",{"class":"cke_widget_wrapper cke_widget_block","contenteditable":"false","data-cke-display-name":"macro:velocity","data-cke-filter":"off","data-cke-widget-id":"0","data-cke-widget-wrapper":"1","tabindex":"-1"},[["DIV",{"class":"macro cke_widget_element","data-cke-widget-data":"%7B%22classes%22%3A%7B%22macro%22%3A1%7D%7D","data-cke-widget-keep-attr":"0","data-cke-widget-upcasted":"1","data-macro":"startmacro:velocity|-||-|Here is a macro","data-widget":"xwiki-macro"},[["P",{},["Here is a macro"]]]],["SPAN",{"class":"cke_reset cke_widget_drag_handler_container","style":"background: rgba(220, 220, 220, 0.5) url(\\"/customize/cryptofist_small.png\\") repeat scroll 0% 0%; top: -15px; left: 0px; display: block;"},[["IMG",{"class":"cke_reset cke_widget_drag_handler","data-cke-widget-drag-handler":"1","height":"15","src":"data:image/gif;base64,R0lGODlhAQABAPABAP///wAAACH5BAEKAAAALAAAAAABAAEAAAICRAEAOw==","title":"Click and drag to move","width":"15"},[]]]]]]]]',

    ];

    var elementFilter = function () {
        // pass everything
        return true;
    };

    var attributeFilter = function (h) {
        // don't filter anything
        return h;
    };

    var HJSON_equal = function (shjson) {
        assert(function (cb) {
            // parse your stringified Hyperjson
            var hjson;

            try {
                hjson = JSON.parse(shjson);
            } catch (e) {
                console.log(e);
                return false;
            }

            // turn it into a DOM
            var DOM = Hyperjson.toDOM(hjson);

            // turn it back into stringified Hyperjson, but apply filters
            var shjson2 = Sortify(Hyperjson.fromDOM(DOM, elementFilter, attributeFilter));

            return cb(shjson === shjson2);
        },  "expected hyperjson equality");
    };

    HJSON_list.map(HJSON_equal);

    var roundTrip = function (sel) {
        var target = $(sel)[0];
        assert(function (cb) {
            var hjson = Hyperjson.fromDOM(target);
            var cloned = Hyperjson.toDOM(hjson);

            return cb(cloned.outerHTML === target.outerHTML);
        }, "Round trip serialization introduced artifacts.");
    };

    var HTML_list = [
        '#target',
        '#widget',
        '#quot',
    ];

    HTML_list.forEach(roundTrip);

    var strungJSON = function (orig) {
        var result;
        assert(function (cb) {
            result = JSON.stringify(JSON.parse(orig));
            return cb(result === orig);
        }, "expected result (" + result + ") to equal original (" + orig + ")");
    };

    [   '{"border":"1","style":{"width":"500px"}}',
        '{"style":"width: 500px;","border":"1"}',
    ].forEach(function (orig) {
        strungJSON(orig);
    });

    // check that old hashes parse correctly
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#67b8385b07352be53e40746d2be6ccd7XAYSuJYYqa9NfmInyHci7LNy');
        return cb(secret.hashData.channel === "67b8385b07352be53e40746d2be6ccd7" &&
            secret.hashData.key === "XAYSuJYYqa9NfmInyHci7LNy" &&
            secret.hashData.version === 0 &&
            typeof(secret.hashData.getURL) === 'function');
    }, "Old hash failed to parse");

    // make sure version 1 hashes parse correctly
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit/3Ujt4F2Sjnjbis6CoYWpoQ/usn4+9CqVja8Q7RZOGTfRgqI');
        return cb(secret.hashData.version === 1 &&
            secret.hashData.mode === "edit" &&
            secret.hashData.channel === "3Ujt4F2Sjnjbis6CoYWpoQ" &&
            secret.hashData.key === "usn4+9CqVja8Q7RZOGTfRgqI" &&
            !secret.hashData.present);
    }, "version 1 hash (without present mode) failed to parse");

    // test support for present mode in hashes
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit/CmN5+YJkrHFS3NSBg-P7Sg/DNZ2wcG683GscU4fyOyqA87G/present');
        return cb(secret.hashData.version === 1
            && secret.hashData.mode === "edit"
            && secret.hashData.channel === "CmN5+YJkrHFS3NSBg-P7Sg"
            && secret.hashData.key === "DNZ2wcG683GscU4fyOyqA87G"
            && secret.hashData.present);
    }, "version 1 hash failed to parse");

    // test support for present mode in hashes
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit//CmN5+YJkrHFS3NSBg-P7Sg/DNZ2wcG683GscU4fyOyqA87G//present');
        return cb(secret.hashData.version === 1
            && secret.hashData.mode === "edit"
            && secret.hashData.channel === "CmN5+YJkrHFS3NSBg-P7Sg"
            && secret.hashData.key === "DNZ2wcG683GscU4fyOyqA87G"
            && secret.hashData.present);
    }, "Couldn't handle multiple successive slashes");

    // test support for present & embed mode in hashes
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit//CmN5+YJkrHFS3NSBg-P7Sg/DNZ2wcG683GscU4fyOyqA87G/embed/present/');
        return cb(secret.hashData.version === 1
            && secret.hashData.mode === "edit"
            && secret.hashData.channel === "CmN5+YJkrHFS3NSBg-P7Sg"
            && secret.hashData.key === "DNZ2wcG683GscU4fyOyqA87G"
            && secret.hashData.present
            && secret.hashData.embed);
    }, "Couldn't handle multiple successive slashes");

    // test support for present & embed mode in hashes
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit//CmN5+YJkrHFS3NSBg-P7Sg/DNZ2wcG683GscU4fyOyqA87G/present/embed');
        return cb(secret.hashData.version === 1
            && secret.hashData.mode === "edit"
            && secret.hashData.channel === "CmN5+YJkrHFS3NSBg-P7Sg"
            && secret.hashData.key === "DNZ2wcG683GscU4fyOyqA87G"
            && secret.hashData.present
            && secret.hashData.embed);
    }, "Couldn't handle multiple successive slashes");

    // test support for embed mode in hashes
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit//CmN5+YJkrHFS3NSBg-P7Sg/DNZ2wcG683GscU4fyOyqA87G///embed//');
        return cb(secret.hashData.version === 1
            && secret.hashData.mode === "edit"
            && secret.hashData.channel === "CmN5+YJkrHFS3NSBg-P7Sg"
            && secret.hashData.key === "DNZ2wcG683GscU4fyOyqA87G"
            && !secret.hashData.present
            && secret.hashData.embed);
    }, "Couldn't handle multiple successive slashes");

    // test support for trailing slash
    assert(function (cb) {
        var secret = Hash.parsePadUrl('/pad/#/1/edit/3Ujt4F2Sjnjbis6CoYWpoQ/usn4+9CqVja8Q7RZOGTfRgqI/');
        return cb(secret.hashData.version === 1 &&
            secret.hashData.mode === "edit" &&
            secret.hashData.channel === "3Ujt4F2Sjnjbis6CoYWpoQ" &&
            secret.hashData.key === "usn4+9CqVja8Q7RZOGTfRgqI" &&
            !secret.hashData.present);
    }, "test support for trailing slashes in version 1 hash failed to parse");

    assert(function (cb) {
        var secret = Hash.parsePadUrl('/invite/#/1/ilrOtygzDVoUSRpOOJrUuQ/e8jvf36S3chzkkcaMrLSW7PPrz7VDp85lIFNI26dTmr=/');
        var hd = secret.hashData;
        cb(hd.channel === "ilrOtygzDVoUSRpOOJrUuQ" &&
            hd.pubkey === "e8jvf36S3chzkkcaMrLSW7PPrz7VDp85lIFNI26dTmr=" &&
            hd.type === 'invite');
    }, "test support for invite urls");

    assert(function (cb) {
        var url = '/pad/?utm_campaign=new_comment&utm_medium=email&utm_source=thread_mailer#/1/edit/3Ujt4F2Sjnjbis6CoYWpoQ/usn4+9CqVja8Q7RZOGTfRgqI/';
        var secret = Hash.parsePadUrl(url);

        return cb(secret.hashData.version === 1 &&
            secret.hashData.mode === "edit" &&
            secret.hashData.channel === "3Ujt4F2Sjnjbis6CoYWpoQ" &&
            secret.hashData.key === "usn4+9CqVja8Q7RZOGTfRgqI" &&
            !secret.hashData.present);
    }, "test support for ugly tracking query paramaters in url");

    assert(function (cb) {
        // TODO
        return cb(true);
    }, "version 2 hash failed to parse correctly");

    assert(function (cb) {
        Wire.create({
            constructor: function (cb) {
                var service = function (type, data, cb) {
                    switch (type) {
                        case "HEY_BUDDY":
                            return cb(void 0, "SALUT!");
                        default:
                            cb("ERROR");
                    }
                };

                var evt = Util.mkEvent();
                var respond = function (e, out) {
                    evt.fire(e, out);
                };
                cb(void 0, {
                    send: function (raw /*, cb */) {
                        try {
                            var parsed = JSON.parse(raw);
                            var txid = parsed.txid;
                            setTimeout(function () {
                                service(parsed.q, parsed.content, function (e, result) {
                                    respond(JSON.stringify({
                                        txid: txid,
                                        error: e,
                                        content: result,
                                    }));
                                });
                            });
                        } catch (e) { console.error("PEWPEW"); }
                    },
                    receive: function (f) {
                        evt.reg(f);
                    },
                });
            },
        }, function (e, rpc) {
            if (e) { return cb(false); }
            rpc.send('HEY_BUDDY', null, function (e, out) {
                if (e) { return void cb(false); }
                if (out === 'SALUT!') { cb(true); }
            });
        });
    }, "Test rpc factory");

    assert(function (cb) {
        require([
            '/assert/frame/frame.js',
        ], function (Frame) {
            Frame.create(document.body, '/assert/frame/frame.html', function (e, frame) {
                if (e) { return cb(false); }

                var channel = Frame.open(frame, [
                    /.*/i,
                ], 5000);

                channel.send('HELO', null, function (e, res) {
                    if (res === 'EHLO') { return cb(true); }
                    cb(false);
                });
            });
        });
    }, "PEWPEW");

    (function () {
        var guid = Wire.uid();

        var t = Wire.tracker({
            timeout: 1000,
            hook: function (txid, q, content) {
                console.info(JSON.stringify({
                    guid: guid,
                    txid: txid,
                    q: q,
                    content: content,
                }));
            },
        });

        assert(function (cb) {
            t.call('SHOULD_TIMEOUT', null, function (e) {
                if (e === 'TIMEOUT') { return cb(true); }
                cb(false);
            });
        }, 'tracker should timeout');

        assert(function (cb) {
            var id = t.call('SHOULD_NOT_TIMEOUT', null, function (e, out) {
                if (e) { return cb(false); }
                if (out === 'YES') { return cb(true); }
                cb(false);
            });
            t.respond(id, void 0, 'YES');
        }, "tracker should not timeout");
    }());

    Drive.test(assert);

    assert(function (cb) {
        // extract dom elements into a flattened JSON representation
        var flat = Flat.fromDOM(document.body);
        // recreate a _mostly_ equivalent DOM
        var dom = Flat.toDOM(flat);
        // assume we don't care about comments
        var bodyText = document.body.outerHTML.replace(/<!\-\-[\s\S]*?\-\->/g, '');
        // check for equality
        cb(dom.outerHTML === bodyText);
    });

    var swap = function (str, dict) {
        return str.replace(/\{\{(.*?)\}\}/g, function (all, key) {
            return typeof dict[key] !== 'undefined'? dict[key] : all;
        });
    };

    var multiline = function (f) {
        var str;
        f.toString().replace(/\/\*([\s\S]*)\*\//g, function (all, out) {
            str = out;
        });
        return str || '';
        };

        var formatFailures = function () {
        var template = multiline(function () { /*
<p class="error">
Failed on test number {{test}} with error message:
"{{message}}"

</p>
<p>
The test returned:
{{output}}
</p>

<br>

*/});
        return failMessages.map(function (obj) {
            console.log(obj);
            return swap(template, obj);
        }).join("\n");
    };

    runASSERTS(function () {
        $("body").html(function (i, val) {
            var dict = {
                previous: val,
                totalAssertions: ASSERTS.length,
                passedAssertions: assertions,
                plural: (assertions === 1? '' : 's'),
                failMessages: formatFailures()
            };

        var SUCCESS = swap(multiline(function(){/*
<div class="report">{{passedAssertions}} / {{totalAssertions}} test{{plural}} passed.

{{failMessages}}

</div>


{{previous}}
        */}), dict);

            var report = SUCCESS;

            return report;
        });

        var $report = $('.report');
        $report.addClass(failed?'failure':'success');

        if (failed) {
            Test.failed();
        } else {
            Test.passed();
        }
    });

});
