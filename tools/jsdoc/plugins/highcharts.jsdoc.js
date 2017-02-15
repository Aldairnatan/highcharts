/**        
 * @module plugins/highcharts.jsdoc
 * @uathor Chris Vasseng
 *
 */

"use strict";

var logger = require('jsdoc/util/logger');
var Doclet = require('jsdoc/doclet.js').Doclet;
var fs = require('fs');
var options = {};

function decorateOptions(parent, target, option, filename) {

    if (!option) {
        return;
    }

    if (parent && parent.length > 0) {
        parent += '.';
    }

    if (filename) {
        //filename = filename.substr(filename.indexOf('highcharts/'));
    }

    target[option.key.name] = target[option.key.name] || {
        meta: {
            fullname: parent + option.key.name,
            name: option.key.name,
            line: option.key.loc.start.line,
            column: option.key.loc.start.column,
            filename: filename//.replace('highcharts/', '')
        },
        doclet: {},
      //  type: option.key.type,
        children: {}
    };

    if (option.value.type == 'ObjectExpression') {     

        // This is a nested object probably
        option.value.properties.forEach(function (sub) {
            var s = {};

            s = target[option.key.name].children;

            decorateOptions(
                parent + option.key.name,
                s,
                sub,
                filename
            );
        });
    } else if (option.value.type === 'Literal') {
       target[option.key.name].meta.default = option.value.value;
       //target[option.key.name].meta.type = option.value.type;
    } else {
        return;
    }

    // Add options decorations directly to the node
    option.highcharts = option.highcharts || {};
    option.highcharts.fullname = parent + option.key.name;
    option.highcharts.isOption = true;
}

function addToComment(comment, line) {    
    comment = comment || ''; 

    return '/*' + 
            comment.replace('/*', '').replace('*/', '') + 
            '\n * ' + 
            line + 
            '\n*/'
    ;
}

function nodeVisitor(node, e, parser, currentSourceName) {
    var exp,
        args,
        target,
        parent,
        comment,
        properties,
        s
    ;

    if (node.highcharts && node.highcharts.isOption) {       
        if (e.comment) {
            e.comment = e.comment.replace('*/', '\n* @optionparent ' + node.highcharts.fullname + '\n*/');            
        } else {
            e.comment = '/** @optionparent ' + node.highcharts.fullname + ' */';
        }

        return;
    }

    if (node.leadingComments && node.leadingComments.length > 0) {
        comment = node.leadingComments[0].raw;
       
        s = comment.indexOf('@optionparent');
        
        if (s >= 0) {
            s = comment.substr(s).replace(/\*/g, '').trim();
            
            parent = s.split('\n')[0].trim().split(' ');
            
            console.log('doing optionparent:', currentSourceName, '->', parent.length > 1 ? parent[1] : 'root');
            
            if (parent && parent.length > 1) {
                parent = parent[1].trim() || '';
                
                s = parent.split('.');
                target = options;

                s.forEach(function (p, i) {
                    
                    target[p] = target[p] || {
                        doclet: {},
                        children: {}
                    };

                    target = target[p].children; 
                });                
            } else {
                parent = '';
                target = options;
            }
            
            if (target) {                

                if (node.type === 'CallExpression' && node.callee.name === 'seriesType') {
                    properties = node.arguments[2].properties;
                } else if (node.type === 'ObjectExpression') {                
                    properties = node.properties;                
                } else if (node.init && node.init.type === 'ObjectExpression') {
                    properties = node.init.properties;
                } else if (node.value && node.value.type === 'ObjectExpression') {
                    properties = node.value.properties;
                } else if (node.operator === '=' && node.right.type === 'ObjectExpression') {
                    properties = node.right.properties;
                } else if (node.right && node.right.type === 'CallExpression' && node.right.callee.property.name === 'seriesType') {
                    properties = node.right.arguments[2].properties;
                } else {    
                    logger.error('code tagged with @optionparent must be an object:', node.right);
                }

                if (properties && properties.length > 0) {
                    properties.forEach(function (child) {
                        decorateOptions(parent, target, child, e.filename || currentSourceName);
                    });
                }

            } else {
                logger.error('@optionparent is missing an argument');
            }       
        }
    } 
}

////////////////////////////////////////////////////////////////////////////////

function augmentOption(path, obj) {
    // This is super nasty.
    var current = options,
        p = (path || '').split('.')
    ;
    
  //  console.log('augmenting', path);

    if (!obj) {
        return;
    }

    if (p.length === 0) {

    }

    p.forEach(function (thing, i) {
        if (i === p.length - 1) {
            // Merge in stuff

            current[thing] = current[thing] || {
                doclet: {},
                children: {}
            };

            Object.keys(obj).forEach(function (property) {
                if (property !== 'comment' && property !== 'meta') {
                    current[thing].doclet[property] = obj[property];
                }
            });

            current[thing].meta = current[thing].meta || {};

            if (obj && obj.meta) {
                if (current[thing].meta.filename === '??') {
                    current[thing].meta.filename = obj.meta.filename.substr(
                        obj.meta.filename.indexOf('highcharts/')
                    );                    
                }
            } 
        
            return;
        }
        current[thing] = current[thing] || {children: {}}; 
        current = current[thing].children;
   });
}

////////////////////////////////////////////////////////////////////////////////

exports.defineTags = function (dictionary) {
    dictionary.defineTag('apioption', {
        onTagged: function (doclet, tagObj) {
            augmentOption(tagObj.value, doclet);
        }
    });

    dictionary.defineTag('sample', {
        onTagged: function (doclet, tagObj) {
            var del = tagObj.text.indexOf(' '),
                name = tagObj.text.substr(del).trim().replace(/\s\s+/g, ' ')
            ;

            doclet.samples = doclet.samples || {};
            doclet.samples[name] = tagObj.text.substr(0, del).trim();
        }
    });

    dictionary.defineTag('optionparent', {
        onTagged: function (doclet, tagObj) {
            //doclet.fullname = tagObj.value;
            augmentOption(tagObj.value, doclet);
        }
    });

    dictionary.defineTag('product', {
        onTagged: function (doclet, tagObj) {
            doclet.products = tagObj.value.split(' ');
        }
    });

    dictionary.defineTag('exclude', {
        onTagged: function (doclet, tagObj) {
            var items = tagObj.text.split(',');
            
            doclet.exclude = doclet.exclude || [];

            items.forEach(function (entry) {
                doclet.exclude.push(entry.trim());
            });
        }
    });

    dictionary.defineTag('extends', {
        onTagged: function (doclet, tagObj) {
            doclet.extends = tagObj.value;     
        }
    });
};

exports.astNodeVisitor = {
    visitNode: nodeVisitor
};

exports.handlers = {
    beforeParse: function (e) {
        
    },

    jsdocCommentFound: function (e) {

    },

    newDoclet: function (e) {

    },

    parseComplete: function () {
        fs.writeFile(
            'tree.json', 
            JSON.stringify(
                options, 
                undefined, 
                '  '
            ), 
            function () {

            }
        );
    }
};