/*!
 * numbro.js
 * version : 1.5.1
 * author : Företagsplatsen AB
 * license : MIT
 * http://www.foretagsplatsen.se
 */

(function () {
    'use strict';

    /************************************
        Constants
    ************************************/

    var numbro,
        VERSION = '1.5.1',
        // internal storage for language config files
        languages = {},
        // global configuration, overridable in Numbro instances
        currentLanguage = 'en-US',
        zeroFormat = null,
        defaultFormat = '0,0',
        defaultCurrencyFormat = '0$',
        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports);


    /************************************
        Constructors
    ************************************/


    // Numbro prototype object
    //   number: number to initialize the numbro instance with
    //   config: optional overrides for global configuration variables
    function Numbro(number, config) {
        var key;
        this._value = number;
        this._config = {};
        // clone the configuration not to modify the source object
        if (config) {
            for (key in config) {
                if (Object.hasOwnProperty.call(config, key)) {
                    this._config[key] = config[key];
                }
            }
        }
    }

    /**
     * Implementation of toFixed() that treats floats more like decimals
     *
     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === '0.61') that present
     * problems for accounting- and finance-related software.
     */
    function toFixed(value, precision, roundingFunction, optionals) {
        var power = Math.pow(10, precision),
            optionalsRegExp,
            output;

        //roundingFunction = (roundingFunction !== undefined ? roundingFunction : Math.round);
        // Multiply up by precision, round accurately, then divide and use native toFixed():
        output = (roundingFunction(value * power) / power).toFixed(precision);

        if (optionals) {
            optionalsRegExp = new RegExp('0{1,' + optionals + '}$');
            output = output.replace(optionalsRegExp, '');
        }

        return output;
    }

    /************************************
        Formatting
    ************************************/

    // determine what type of formatting we need to do
    function formatNumbro(n, format, roundingFunction) {
        var output;

        // figure out what kind of format we are dealing with
        if (format.indexOf('$') > -1) { // currency!!!!!
            output = formatCurrency(n, format, roundingFunction);
        } else if (format.indexOf('%') > -1) { // percentage
            output = formatPercentage(n, format, roundingFunction);
        } else if (format.indexOf(':') > -1) { // time
            output = formatTime(n, format);
        } else { // plain ol' numbers or bytes
            output = formatNumber(n, n._value, format, roundingFunction);
        }

        // return string
        return output;
    }

    // revert to number
    function unformatNumbro(n, string) {
        var stringOriginal = string,
            languageConfig = languages[n._config.currentLanguage || currentLanguage],
            currentZeroFormat,
            thousandRegExp,
            millionRegExp,
            billionRegExp,
            trillionRegExp,
            binarySuffixes = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
            decimalSuffixes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            bytesMultiplier = false,
            power;

        if (string.indexOf(':') > -1) {
            n._value = unformatTime(string);
        } else {
            currentZeroFormat = n._config.zeroFormat || zeroFormat;
            if (string === currentZeroFormat) {
                n._value = 0;
            } else {
                if (languageConfig.delimiters.decimal !== '.') {
                    string = string.replace(/\./g, '').replace(languageConfig.delimiters.decimal, '.');
                }

                // see if abbreviations are there so that we can multiply to the correct number
                thousandRegExp = new RegExp('[^a-zA-Z]' + languageConfig.abbreviations.thousand +
                    '(?:\\)|(\\' + languageConfig.currency.symbol + ')?(?:\\))?)?$');
                millionRegExp = new RegExp('[^a-zA-Z]' + languageConfig.abbreviations.million +
                    '(?:\\)|(\\' + languageConfig.currency.symbol + ')?(?:\\))?)?$');
                billionRegExp = new RegExp('[^a-zA-Z]' + languageConfig.abbreviations.billion +
                    '(?:\\)|(\\' + languageConfig.currency.symbol + ')?(?:\\))?)?$');
                trillionRegExp = new RegExp('[^a-zA-Z]' + languageConfig.abbreviations.trillion +
                    '(?:\\)|(\\' + languageConfig.currency.symbol + ')?(?:\\))?)?$');

                // see if bytes are there so that we can multiply to the correct number
                for (power = 0; power <= binarySuffixes.length && !bytesMultiplier; power++) {
                    if (string.indexOf(binarySuffixes[power]) > -1) {
                        bytesMultiplier = Math.pow(1024, power + 1);
                    } else if (string.indexOf(decimalSuffixes[power]) > -1) {
                        bytesMultiplier = Math.pow(1000, power + 1);
                    }
                }

                // do some math to create our number
                n._value = ((bytesMultiplier) ? bytesMultiplier : 1) *
                    ((stringOriginal.match(thousandRegExp)) ? Math.pow(10, 3) : 1) *
                    ((stringOriginal.match(millionRegExp)) ? Math.pow(10, 6) : 1) *
                    ((stringOriginal.match(billionRegExp)) ? Math.pow(10, 9) : 1) *
                    ((stringOriginal.match(trillionRegExp)) ? Math.pow(10, 12) : 1) *
                    ((string.indexOf('%') > -1) ? 0.01 : 1) *
                    (((string.split('-').length +
                        Math.min(string.split('(').length - 1, string.split(')').length - 1)) % 2) ? 1 : -1) *
                    Number(string.replace(/[^0-9\.]+/g, ''));

                // round if we are talking about bytes
                n._value = (bytesMultiplier) ? Math.ceil(n._value) : n._value;
            }
        }
        return n._value;
    }

    function formatCurrency(n, originalFormat, roundingFunction) {
        var format = originalFormat,
            languageConfig = languages[n._config.currentLanguage || currentLanguage],
            symbolIndex = format.indexOf('$'),
            openParenIndex = format.indexOf('('),
            plusSignIndex = format.indexOf('+'),
            minusSignIndex = format.indexOf('-'),
            space = '',
            decimalSeparator = '',
            spliceIndex,
            output;

        if(format.indexOf('$') === -1){
            // Use defaults instead of the format provided
            if (languageConfig.currency.position === 'infix') {
                decimalSeparator = languageConfig.currency.symbol;
                if (languageConfig.currency.spaceSeparated) {
                    decimalSeparator = ' ' + decimalSeparator + ' ';
                }
            } else if (languageConfig.currency.spaceSeparated) {
                space = ' ';
            }
        } else {
            // check for space before or after currency
            if (format.indexOf(' $') > -1) {
                space = ' ';
                format = format.replace(' $', '');
            } else if (format.indexOf('$ ') > -1) {
                space = ' ';
                format = format.replace('$ ', '');
            } else {
                format = format.replace('$', '');
            }
        }

        // Format The Number
        output = formatNumber(n, n._value, format, roundingFunction, decimalSeparator);

        if (originalFormat.indexOf('$') === -1) {
            // Use defaults instead of the format provided
            switch (languageConfig.currency.position) {
                case 'postfix':
                    if (output.indexOf(')') > -1) {
                        output = output.split('');
                        output.splice(-1, 0, space + languageConfig.currency.symbol);
                        output = output.join('');
                    } else {
                        output = output + space + languageConfig.currency.symbol;
                    }
                    break;
                case 'infix':
                    break;
                case 'prefix':
                    if (output.indexOf('(') > -1 || output.indexOf('-') > -1) {
                        output = output.split('');
                        spliceIndex = Math.max(openParenIndex, minusSignIndex) + 1;

                        output.splice(spliceIndex, 0, languageConfig.currency.symbol + space);
                        output = output.join('');
                    } else {
                        output = languageConfig.currency.symbol + space + output;
                    }
                    break;
                default:
                    throw Error('Currency position should be among ["prefix", "infix", "postfix"]');
            }
        } else {
            // position the symbol
            if (symbolIndex <= 1) {
                if (output.indexOf('(') > -1 || output.indexOf('+') > -1 || output.indexOf('-') > -1) {
                    output = output.split('');
                    spliceIndex = 1;
                    if (symbolIndex < openParenIndex || symbolIndex < plusSignIndex || symbolIndex < minusSignIndex) {
                        // the symbol appears before the "(", "+" or "-"
                        spliceIndex = 0;
                    }
                    output.splice(spliceIndex, 0, languageConfig.currency.symbol + space);
                    output = output.join('');
                } else {
                    output = languageConfig.currency.symbol + space + output;
                }
            } else {
                if (output.indexOf(')') > -1) {
                    output = output.split('');
                    output.splice(-1, 0, space + languageConfig.currency.symbol);
                    output = output.join('');
                } else {
                    output = output + space + languageConfig.currency.symbol;
                }
            }
        }

        return output;
    }

    function formatPercentage(n, format, roundingFunction) {
        var space = '',
            output,
            value = n._value * 100;

        // check for space before %
        if (format.indexOf(' %') > -1) {
            space = ' ';
            format = format.replace(' %', '');
        } else {
            format = format.replace('%', '');
        }

        output = formatNumber(n, value, format, roundingFunction);

        if (output.indexOf(')') > -1) {
            output = output.split('');
            output.splice(-1, 0, space + '%');
            output = output.join('');
        } else {
            output = output + space + '%';
        }

        return output;
    }

    function formatTime(n) {
        var hours = Math.floor(n._value / 60 / 60),
            minutes = Math.floor((n._value - (hours * 60 * 60)) / 60),
            seconds = Math.round(n._value - (hours * 60 * 60) - (minutes * 60));
        return hours + ':' +
            ((minutes < 10) ? '0' + minutes : minutes) + ':' +
            ((seconds < 10) ? '0' + seconds : seconds);
    }

    function unformatTime(string) {
        var timeArray = string.split(':'),
            seconds = 0;
        // turn hours and minutes into seconds and add them all up
        if (timeArray.length === 3) {
            // hours
            seconds = seconds + (Number(timeArray[0]) * 60 * 60);
            // minutes
            seconds = seconds + (Number(timeArray[1]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[2]);
        } else if (timeArray.length === 2) {
            // minutes
            seconds = seconds + (Number(timeArray[0]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[1]);
        }
        return Number(seconds);
    }

    function formatNumber(n, value, format, roundingFunction, sep) {
        var negP = false,
            signed = false,
            optDec = false,
            abbr = '',
            i,
            abbrK = false, // force abbreviation to thousands
            abbrM = false, // force abbreviation to millions
            abbrB = false, // force abbreviation to billions
            abbrT = false, // force abbreviation to trillions
            abbrForce = false, // force abbreviation
            bytes = '',
            ord = '',
            abs = Math.abs(value),
            languageConfig = languages[n._config.currentLanguage || currentLanguage],
            currentZeroFormat = n._config.zeroFormat || zeroFormat,
            binarySuffixes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
            decimalSuffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            min,
            max,
            power,
            totalLength,
            length,
            minimumPrecision,
            pow,
            w,
            intPrecision,
            precision,
            prefix,
            thousands,
            d = '',
            forcedNeg = false,
            neg = false,
            indexOpenP = -1,
            size,
            indexMinus = -1,
            paren = '';

        // check if number is zero and a custom zero format has been set
        if (value === 0 && currentZeroFormat !== null) {
            return currentZeroFormat;
        } else if (!isFinite(value)) {
            return '' + value;
        } else {
            // see if we should use parentheses for negative number or if we should prefix with a sign
            // if both are present we default to parentheses
            if(format.indexOf('-') !== -1){
                forcedNeg = true;
            }
            if (format.indexOf('(') > -1) {
                negP = true;
                format = format.slice(1, -1);
            } else if (format.indexOf('+') > -1) {
                signed = true;
                format = format.replace(/\+/g, '');
            }

            // see if abbreviation is wanted
            if (format.indexOf('a') > -1) {
                intPrecision = format.split('.')[0].match(/[0-9]+/g) || ['0'];
                intPrecision = parseInt(intPrecision[0], 10);

                // check if abbreviation is specified
                abbrK = format.indexOf('aK') >= 0;
                abbrM = format.indexOf('aM') >= 0;
                abbrB = format.indexOf('aB') >= 0;
                abbrT = format.indexOf('aT') >= 0;
                abbrForce = abbrK || abbrM || abbrB || abbrT;

                // check for space before abbreviation
                if (format.indexOf(' a') > -1) {
                    abbr = ' ';
                    format = format.replace(' a', '');
                } else {
                    format = format.replace('a', '');
                }

                totalLength = Math.floor(Math.log(abs) / Math.LN10) + 1;

                minimumPrecision = totalLength % 3;
                minimumPrecision = minimumPrecision === 0 ? 3 : minimumPrecision;

                if(intPrecision) {

                    length = Math.floor(Math.log(abs) / Math.LN10) + 1 - intPrecision;

                    pow = 3 * ~~((Math.min(intPrecision, totalLength) - minimumPrecision) / 3);

                    abs = abs / Math.pow(10, pow);

                    if (format.indexOf('.') === -1 && intPrecision > 3) {
                        format += '[.]';

                        size = length === 0 ? 0 : 3 * ~~(length / 3) - length;
                        size = size < 0 ? size + 3 : size;

                        for (i = 0; i < size; i++) {
                            format += '0';
                        }
                    }
                }

                if (Math.floor(Math.log(Math.abs(value)) / Math.LN10) + 1 !== intPrecision){
                    if (abs >= Math.pow(10, 12) && !abbrForce || abbrT) {
                        // trillion
                        abbr = abbr + languageConfig.abbreviations.trillion;
                        value = value / Math.pow(10, 12);
                    } else if (abs < Math.pow(10, 12) && abs >= Math.pow(10, 9) && !abbrForce || abbrB) {
                        // billion
                        abbr = abbr + languageConfig.abbreviations.billion;
                        value = value / Math.pow(10, 9);
                    } else if (abs < Math.pow(10, 9) && abs >= Math.pow(10, 6) && !abbrForce || abbrM) {
                        // million
                        abbr = abbr + languageConfig.abbreviations.million;
                        value = value / Math.pow(10, 6);
                    } else if (abs < Math.pow(10, 6) && abs >= Math.pow(10, 3) && !abbrForce || abbrK) {
                        // thousand
                        abbr = abbr + languageConfig.abbreviations.thousand;
                        value = value / Math.pow(10, 3);
                    }
                }
            }

            // see if we are formatting binary bytes
            if (format.indexOf('b') > -1) {
                // check for space before
                if (format.indexOf(' b') > -1) {
                    bytes = ' ';
                    format = format.replace(' b', '');
                } else {
                    format = format.replace('b', '');
                }

                for (power = 0; power <= binarySuffixes.length; power++) {
                    min = Math.pow(1024, power);
                    max = Math.pow(1024, power + 1);

                    if (value >= min && value < max) {
                        bytes = bytes + binarySuffixes[power];
                        if (min > 0) {
                            value = value / min;
                        }
                        break;
                    }
                }
            }

            // see if we are formatting decimal bytes
            if (format.indexOf('d') > -1) {
                // check for space before
                if (format.indexOf(' d') > -1) {
                    bytes = ' ';
                    format = format.replace(' d', '');
                } else {
                    format = format.replace('d', '');
                }

                for (power = 0; power <= decimalSuffixes.length; power++) {
                    min = Math.pow(1000, power);
                    max = Math.pow(1000, power + 1);

                    if (value >= min && value < max) {
                        bytes = bytes + decimalSuffixes[power];
                        if (min > 0) {
                            value = value / min;
                        }
                        break;
                    }
                }
            }

            // see if ordinal is wanted
            if (format.indexOf('o') > -1) {
                // check for space before
                if (format.indexOf(' o') > -1) {
                    ord = ' ';
                    format = format.replace(' o', '');
                } else {
                    format = format.replace('o', '');
                }

                if (languageConfig.ordinal){
                    ord = ord + languageConfig.ordinal(value);
                }
            }

            if (format.indexOf('[.]') > -1) {
                optDec = true;
                format = format.replace('[.]', '.');
            }

            w = value.toString().split('.')[0];
            precision = format.split('.')[1];
            thousands = format.indexOf(',');

            if (precision) {
                if (precision.indexOf('[') > -1) {
                    precision = precision.replace(']', '');
                    precision = precision.split('[');
                    d = toFixed(value, (precision[0].length + precision[1].length), roundingFunction,
                            precision[1].length);
                } else {
                    d = toFixed(value, precision.length, roundingFunction);
                }

                w = d.split('.')[0];

                if (d.split('.')[1].length) {
                    prefix = sep ? abbr + sep : languageConfig.delimiters.decimal;
                    d = prefix + d.split('.')[1];
                } else {
                    d = '';
                }

                if (optDec && Number(d.slice(1)) === 0) {
                    d = '';
                }
            } else {
                w = toFixed(value, null, roundingFunction);
            }

            // format number
            if (w.indexOf('-') > -1) {
                w = w.slice(1);
                neg = true;
            }

            if (thousands > -1) {
                w = w.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' +
                    languageConfig.delimiters.thousands);
            }

            if (format.indexOf('.') === 0) {
                w = '';
            }

            indexOpenP = format.indexOf('(');
            indexMinus = format.indexOf('-');

            if(indexOpenP < indexMinus) {
                paren = ((negP && neg) ? '(' : '') + (((forcedNeg && neg) || (!negP && neg)) ? '-' : '');
            } else {
                paren = (((forcedNeg && neg) || (!negP && neg)) ? '-' : '') + ((negP && neg) ? '(' : '');
            }


            return paren + ((!neg && signed && value !== 0) ? '+' : '') +
                w + d +
                ((ord) ? ord : '') +
                ((abbr && !sep) ? abbr : '') +
                ((bytes) ? bytes : '') +
                ((negP && neg) ? ')' : '');
        }
    }

    /************************************
        Top Level Functions
    ************************************/

    // Clones the specified or the current global configuration to a new
    // numbro factory function, which will be configurable separately
    function cloneNumbro(config) {
        if (!config) {
            config = {};
        }
        // Configuration of the numro factory function clone
        var _config = {
            currentLanguage: config.currentLanguage || currentLanguage,
            zeroFormat: config.zeroFormat || zeroFormat,
            defaultFormat: config.defaultFormat || defaultFormat,
            defaultCurrencyFormat: config.defaultCurrencyFormat || defaultCurrencyFormat
        };

        // Factory function clone for numbro
        var numbroClone = function(input) {
            return createNumbro(input, _config);
        };

        // Clones the numbro factory function with its current configuration
        numbroClone.clone = function () {
            return cloneNumbro(_config);
        };

        // version number
        numbroClone.version = numbro.version;

        // compare numbro object
        numbroClone.isNumbro = numbro.isNumbro;

        // This function will load languages and then set the global language.  If
        // no arguments are passed in, it will simply return the current global
        // language key.
        numbroClone.language = function(key, values) {
            var language;
            if (!key) {
                return _config.currentLanguage;
            }

            if (key && !values) {
                language = languages[key];
                if (!language) {
                    throw new Error('Unknown language : ' + key);
                }
                _config.currentLanguage = key;
                setDefaultsFromLanguage(numbroClone, language);
            }

            if (values || !languages[key]) {
                loadLanguage(key, values);
            }

            return numbroClone;
        };

        // This function allow the user to set a new language with a fallback if
        // the language does not exist. If no fallback language is provided,
        // it fallbacks to english.
        numbroClone.setLanguage = numbro.setLanguage;

        // This function provides access to the loaded language data.  If
        // no arguments are passed in, it will simply return the current
        // global language object.
        numbroClone.languageData = function(key) {
            if (!key) {
                return languages[_config.currentLanguage];
            }
            return numbro.languageData(key);
        };

        numbroClone.languages = numbro.languages;

        numbroClone.zeroFormat = function(format) {
            _config.zeroFormat = typeof(format) === 'string' ? format : null;
        };

        numbroClone.defaultFormat = function(format) {
            _config.defaultFormat = typeof(format) === 'string' ? format : '0.0';
        };

        numbroClone.defaultCurrencyFormat = function (format) {
            _config.defaultCurrencyFormat = typeof(format) === 'string' ? format : '0$';
        };

        numbroClone.validate = numbro.validate;

        return numbroClone;
    }

    // Factory function for numbro
    numbro = function(input) {
        return createNumbro(input);
    };

    // clones the numbro factory function with the current state
    // of the global configuration
    numbro.clone = function () {
        return cloneNumbro();
    };

    // version number
    numbro.version = VERSION;

    // compare numbro object
    numbro.isNumbro = function(obj) {
        return obj instanceof Numbro;
    };

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    numbro.language = function(key, values) {
        var language;
        if (!key) {
            return currentLanguage;
        }

        if (key && !values) {
            language = languages[key];
            if (!language) {
                throw new Error('Unknown language : ' + key);
            }
            currentLanguage = key;
            setDefaultsFromLanguage(numbro, language);
        }

        if (values || !languages[key]) {
            loadLanguage(key, values);
        }

        return numbro;
    };

    // This function allow the user to set a new language with a fallback if
    // the language does not exist. If no fallback language is provided,
    // it fallbacks to english.
    numbro.setLanguage = function(newLanguage, fallbackLanguage) {
        newLanguage = getClosestLanguage(newLanguage, fallbackLanguage);
        return this.language(newLanguage);
    };

    // This function provides access to the loaded language data.  If
    // no arguments are passed in, it will simply return the current
    // global language object.
    numbro.languageData = function(key) {
        if (!key) {
            return languages[currentLanguage];
        }

        if (!languages[key]) {
            throw new Error('Unknown language : ' + key);
        }

        return languages[key];
    };

    numbro.language('en-US', {
        delimiters: {
            thousands: ',',
            decimal: '.'
        },
        abbreviations: {
            thousand: 'k',
            million: 'm',
            billion: 'b',
            trillion: 't'
        },
        ordinal: function(number) {
            var b = number % 10;
            return (~~(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
        },
        currency: {
            symbol: '$',
            position: 'prefix'
        },
        defaults: {
            currencyFormat: ',0000 a'
        },
        formats: {
            fourDigits: '0000 a',
            fullWithTwoDecimals: '$ ,0.00',
            fullWithTwoDecimalsNoCurrency: ',0.00'
        }
    });

    numbro.languages = function() {
        return languages;
    };

    numbro.zeroFormat = function(format) {
        zeroFormat = typeof(format) === 'string' ? format : null;
    };

    numbro.defaultFormat = function(format) {
        defaultFormat = typeof(format) === 'string' ? format : '0.0';
    };

    numbro.defaultCurrencyFormat = function (format) {
        defaultCurrencyFormat = typeof(format) === 'string' ? format : '0$';
    };

    numbro.validate = function(val, culture) {

        var _decimalSep,
            _thousandSep,
            _currSymbol,
            _valArray,
            _abbrObj,
            _thousandRegEx,
            languageData,
            temp;

        //coerce val to string
        if (typeof val !== 'string') {
            val += '';
            if (console.warn) {
                console.warn('Numbro.js: Value is not string. It has been co-erced to: ', val);
            }
        }

        //trim whitespaces from either sides
        val = val.trim();

        //if val is just digits return true
        if ( !! val.match(/^\d+$/)) {
            return true;
        }

        //if val is empty return false
        if (val === '') {
            return false;
        }

        //get the decimal and thousands separator from numbro.languageData
        try {
            //check if the culture is understood by numbro. if not, default it to current language
            languageData = this.languageData(culture);
        } catch (e) {
            languageData = this.languageData(this.language());
        }

        //setup the delimiters and currency symbol based on culture/language
        _currSymbol = languageData.currency.symbol;
        _abbrObj = languageData.abbreviations;
        _decimalSep = languageData.delimiters.decimal;
        if (languageData.delimiters.thousands === '.') {
            _thousandSep = '\\.';
        } else {
            _thousandSep = languageData.delimiters.thousands;
        }

        // validating currency symbol
        temp = val.match(/^[^\d]+/);
        if (temp !== null) {
            val = val.substr(1);
            if (temp[0] !== _currSymbol) {
                return false;
            }
        }

        //validating abbreviation symbol
        temp = val.match(/[^\d]+$/);
        if (temp !== null) {
            val = val.slice(0, -1);
            if (temp[0] !== _abbrObj.thousand && temp[0] !== _abbrObj.million &&
                    temp[0] !== _abbrObj.billion && temp[0] !== _abbrObj.trillion) {
                return false;
            }
        }

        _thousandRegEx = new RegExp(_thousandSep + '{2}');

        if (!val.match(/[^\d.,]/g)) {
            _valArray = val.split(_decimalSep);
            if (_valArray.length > 2) {
                return false;
            } else {
                if (_valArray.length < 2) {
                    return ( !! _valArray[0].match(/^\d+.*\d$/) && !_valArray[0].match(_thousandRegEx));
                } else {
                    if (_valArray[0].length === 1) {
                        return ( !! _valArray[0].match(/^\d+$/) &&
                            !_valArray[0].match(_thousandRegEx) &&
                            !! _valArray[1].match(/^\d+$/));
                    } else {
                        return ( !! _valArray[0].match(/^\d+.*\d$/) &&
                            !_valArray[0].match(_thousandRegEx) &&
                            !! _valArray[1].match(/^\d+$/));
                    }
                }
            }
        }

        return false;
    };

    /************************************
        Helpers
    ************************************/

    // Creates a new numbro instance
    function createNumbro(input, config) {
        var number, instance;
        if (numbro.isNumbro(input)) {
            return new Numbro(input.value(), input._config);
        }
        if (input === 0 || typeof input === 'undefined') {
            return new Numbro(0, config);
        }
        number = Number(input);
        if (isNaN(number)) {
            // Do not call unformat on the prototype; instance
            // configuration may be accessed
            instance = new Numbro(undefined, config);
            instance.set(instance.unformat(input));
            return instance;
        }
        return new Numbro(number, config);
    }

    // Propagates language defaults to the caller context
    function setDefaultsFromLanguage(numbroContext, language) {
        var defaults = language.defaults;
        if (defaults) {
            if (defaults.format) {
                numbroContext.defaultFormat(defaults.format);
            }
            if (defaults.currencyFormat) {
                numbroContext.defaultCurrencyFormat(defaults.currencyFormat);
            }
        }
    }

    // Checks if the preferred language exists and return is, if it does;
    // if that language does not exist, it continues looking for a similar
    // language by the language prefix.  If nothing is found, it returns
    // the fallback language, or English, if no fallback is provided.
    function getClosestLanguage(preferredLanguage, fallbackLanguage) {
        var prefix, matchingLanguage;
        if (!languages[preferredLanguage]) {
            prefix = preferredLanguage.split('-')[0];
            Object.keys(languages).some(function(language) {
                if (language.split('-')[0] === prefix){
                    matchingLanguage = language;
                    return true;
                }
            });
            preferredLanguage = matchingLanguage || fallbackLanguage || 'en-US';
        }
        return preferredLanguage;
    }

    function loadLanguage(key, values) {
        languages[key] = values;
    }

    /************************************
        Floating-point helpers
    ************************************/

    // The floating-point helper functions and implementation
    // borrows heavily from sinful.js: http://guipn.github.io/sinful.js/

    /**
     * Array.prototype.reduce for browsers that don't support it
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Compatibility
     */
    if ('function' !== typeof Array.prototype.reduce) {
        Array.prototype.reduce = function(callback, optInitialValue) {

            if (null === this || 'undefined' === typeof this) {
                // At the moment all modern browsers, that support strict mode, have
                // native implementation of Array.prototype.reduce. For instance, IE8
                // does not support strict mode, so this check is actually useless.
                throw new TypeError('Array.prototype.reduce called on null or undefined');
            }

            if ('function' !== typeof callback) {
                throw new TypeError(callback + ' is not a function');
            }

            var index,
                value,
                length = this.length >>> 0,
                isValueSet = false;

            if (1 < arguments.length) {
                value = optInitialValue;
                isValueSet = true;
            }

            for (index = 0; length > index; ++index) {
                if (this.hasOwnProperty(index)) {
                    if (isValueSet) {
                        value = callback(value, this[index], index, this);
                    } else {
                        value = this[index];
                        isValueSet = true;
                    }
                }
            }

            if (!isValueSet) {
                throw new TypeError('Reduce of empty array with no initial value');
            }

            return value;
        };
    }


    /**
     * Computes the multiplier necessary to make x >= 1,
     * effectively eliminating miscalculations caused by
     * finite precision.
     */
    function multiplier(x) {
        var parts = x.toString().split('.');
        if (parts.length < 2) {
            return 1;
        }
        return Math.pow(10, parts[1].length);
    }

    /**
     * Given a variable number of arguments, returns the maximum
     * multiplier that must be used to normalize an operation involving
     * all of them.
     */
    function correctionFactor() {
        var args = Array.prototype.slice.call(arguments);
        return args.reduce(function(prev, next) {
            var mp = multiplier(prev),
                mn = multiplier(next);
            return mp > mn ? mp : mn;
        }, -Infinity);
    }


    /************************************
        Numbro Prototype
    ************************************/


    numbro.fn = Numbro.prototype = {

        clone: function() {
            return numbro(this);
        },

        format: function(inputString, roundingFunction) {
            var currentFormat = this._config.defaultFormat || defaultFormat;
            return formatNumbro(this,
                inputString ? inputString : currentFormat,
                (roundingFunction !== undefined) ? roundingFunction : Math.round
            );
        },

        formatCurrency: function(inputString, roundingFunction) {
            var currentFormat = this._config.defaultCurrencyFormat || defaultCurrencyFormat;
            return formatCurrency(this,
                inputString ? inputString : currentFormat,
                (roundingFunction !== undefined) ? roundingFunction : Math.round
            );
        },

        unformat: function(inputString) {
            var currentFormat;
            if (Object.prototype.toString.call(inputString) === '[object Number]') {
                return inputString;
            }
            currentFormat = this._config.defaultFormat || defaultFormat;
            return unformatNumbro(this, inputString ? inputString : currentFormat);
        },

        value: function() {
            return this._value;
        },

        valueOf: function() {
            return this._value;
        },

        set: function(value) {
            this._value = Number(value);
            return this;
        },

        add: function(value) {
            var corrFactor = correctionFactor.call(null, this._value, value);

            function cback(accum, curr) {
                return accum + corrFactor * curr;
            }
            this._value = [this._value, value].reduce(cback, 0) / corrFactor;
            return this;
        },

        subtract: function(value) {
            var corrFactor = correctionFactor.call(null, this._value, value);

            function cback(accum, curr) {
                return accum - corrFactor * curr;
            }
            this._value = [value].reduce(cback, this._value * corrFactor) / corrFactor;
            return this;
        },

        multiply: function(value) {
            function cback(accum, curr) {
                var corrFactor = correctionFactor(accum, curr),
                    result = accum * corrFactor;
                result *= curr * corrFactor;
                result /= corrFactor * corrFactor;
                return result;
            }
            this._value = [this._value, value].reduce(cback, 1);
            return this;
        },

        divide: function(value) {
            function cback(accum, curr) {
                var corrFactor = correctionFactor(accum, curr);
                return (accum * corrFactor) / (curr * corrFactor);
            }
            this._value = [this._value, value].reduce(cback);
            return this;
        },

        difference: function(value) {
            return Math.abs(numbro(this._value).subtract(value).value());
        },

        // Gets the language set for this instance, or the global language,
        // if theis instance has no explicitly assigned langugae; if the key
        // argumenmt is passed in, it set the instance language
        language: function(key) {
            if (!key) {
                return this._config.currentLanguage || currentLanguage;
            }

            var language = languages[key];
            if (!language) {
                throw new Error('Unknown language : ' + key);
            }
            this._config.currentLanguage = key;
            setDefaultsFromLanguage(this, language);

            return this;
        },

        // Sets the language for this instance; if the language does not exist,
        // it tries to find a similar language by the language prefix only, then
        // it sets the fallback language or English, if no fallback is provided
        setLanguage: function(newLanguage, fallbackLanguage) {
            newLanguage = getClosestLanguage(newLanguage, fallbackLanguage);
            return this.language(newLanguage);
        },

        // Sets the zero format for this instance
        zeroFormat: function(format) {
            this._config.zeroFormat = typeof(format) === 'string' ? format : null;
            return this;
        },

        // Sets the default plain format for this instance
        defaultFormat: function(format) {
            this._config.defaultFormat = typeof(format) === 'string' ? format : '0.0';
            return this;
        },

        // Sets the default currency format for this instance
        defaultCurrencyFormat: function (format) {
            this._config.defaultCurrencyFormat = typeof(format) === 'string' ? format : '0$';
            return this;
        }

    };

    /************************************
        Exposing Numbro
    ************************************/

    // CommonJS module is defined
    if (hasModule) {
        module.exports = numbro;

        // Load all languages
        var fs = require('fs'),
            path = require('path');
        var langFiles = fs.readdirSync(path.join(__dirname, 'languages'));
        langFiles.forEach(function (langFile) {
            numbro.language(path.basename(langFile, '.js'), require(path.join(__dirname, 'languages', langFile)));
        });
    }

    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `numbro` as a global object via a string identifier,
        // for Closure Compiler 'advanced' mode
        this.numbro = numbro;
    }

    /*global define:false */
    if (typeof define === 'function' && define.amd) {
        define([], function() {
            return numbro;
        });
    }
}.call(typeof window === 'undefined' ? this : window));
