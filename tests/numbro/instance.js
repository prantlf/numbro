'use strict';

var numbro = require('../../numbro');
require('./test-locale');

// Check that changes to instance configuration apply to the particular
// instance and do not modify the defaults
exports.instance = {

    // Check that the instance language method applies only to the instance
    language: function (test) {
        test.expect(3);

        var n = numbro();
        n.language('test-TEST');
        test.strictEqual(n.language(), 'test-TEST', 'local');
        n.setLanguage('test');
        test.strictEqual(n.language(), 'test-TEST', 'local prefix');

        test.strictEqual(numbro.language(), 'en-US', 'global');

        test.done();
    },

    // Check that the instance zeroFormat method applies only to the instance
    zeroFormat: function (test) {
        test.expect(4);

        var n = numbro(0);
        n.zeroFormat('nothing');
        test.strictEqual(n.format(), 'nothing', 'local');
        test.strictEqual(n.formatCurrency(), '$nothing', 'local currency');

        test.strictEqual(numbro(0).format(), '0', 'global');
        test.strictEqual(numbro(0).formatCurrency(), '$0 ', 'global currency');

        test.done();
    },

    // Check that the instance defaultFormat method applies only to the instance
    defaultFormat: function (test) {
        test.expect(2);

        var n = numbro(1234.56);
        n.defaultFormat('0.0[0000]');
        test.strictEqual(n.format(), '1234.56', 'local');

        test.strictEqual(numbro(1234.56).format(), '1,235', 'global');

        test.done();
    },

    // Check that the instance defaultCurrencyFormat method applies only to the instance
    defaultCurrencyFormat: function (test) {
        test.expect(2);

        var n = numbro(1234.56);
        n.defaultCurrencyFormat('0.0[0000] $');
        test.strictEqual(n.formatCurrency(), '1234.56 $', 'local');

        test.strictEqual(numbro(1234.56).formatCurrency(), '$1 k', 'global');

        test.done();
    }

};