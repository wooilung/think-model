function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const helper = require('think-helper');
const path = require('path');
const assert = require('assert');
const Relation = require('./relation/relation.js');
const util = require('util');

const MODELS = Symbol('think-models');
const DB = Symbol('think-model-db');
const RELATION = Symbol('think-model-relation');
const QUOTE_FIELD = Symbol('think-model-quote-field');

module.exports = class Model {
  /**
   * constructor
   * @param  {} name   []
   * @param  {} config []
   * @return {}        []
   */
  constructor(modelName = '', config = {}) {
    if (helper.isObject(modelName)) {
      [modelName, config] = ['', modelName];
    }
    assert(helper.isFunction(config.handle), 'config.handle must be a function');
    this.config = config;
    this.modelName = modelName;
    this.options = {};
    this[RELATION] = new Relation(this);
  }
  /**
   * get or set adapter
   * @param {Object} connection
   */
  db(db) {
    const Handle = this.config.handle;
    if (db) {
      this[DB] = new Handle(this, { query: db.query });
      return this;
    }
    if (this[DB]) return this[DB];
    const instance = new Handle(this);
    this[DB] = instance;
    return instance;
  }
  /**
   * get all store models
   */
  get models() {
    return this[MODELS] || {};
  }
  /**
   * set models
   */
  set models(value) {
    this[MODELS] = value;
  }
  /**
   * get table prefix
   */
  get tablePrefix() {
    return this.config.prefix || '';
  }
  /**
   * get table name, with table prefix
   */
  get tableName() {
    return this.tablePrefix + this.modelName;
  }
  /**
   * get primary key
   */
  get pk() {
    return this._pk || 'id';
  }
  /**
   * get last sql
   */
  get lastSql() {
    return this.db().lastSql;
  }
  /**
   * get model instance
   * @param {String} name
   */
  model(name) {
    const ModelClass = this.models[name];
    const modelName = path.basename(name);
    let instance;
    if (ModelClass) {
      instance = new ModelClass(modelName, this.config);
    } else {
      instance = new Model(modelName, this.config);
    }
    instance.models = this.models;
    instance._cacheConfig = this._cacheConfig;
    // add reuseDB config for db connection
    if (this.config.reuseDB) {
      instance.db(this.db());
    }
    return instance;
  }
  /**
   * set cache options
   * @param  {String} key     []
   * @param  {Number} timeout []
   * @return {}         []
   */
  cache(key, config) {
    if (key === undefined) return this;
    if (!helper.isString(key)) {
      [key, config] = ['', key];
    }
    if (helper.isNumber(config)) {
      config = { timeout: config };
    }

    // user should set key timeout in here
    // so we should sperate it to avoid it covers cacheConfig.timeout
    if (config && config.timeout) {
      config._keyTimeout = config.timeout;
      delete config.timeout;
    }

    const cacheConfig = this._cacheConfig;
    if (cacheConfig) {
      config = helper.parseAdapterConfig(cacheConfig, this.config.cache, config);
    } else {
      config = helper.parseAdapterConfig(this.config.cache, config);
    }
    if (!config.key) {
      config.key = key;
    }
    assert(helper.isFunction(config.handle), 'cache.handle must be a function');
    this.options.cache = config;
    return this;
  }
  /**
   * set limit options
   * @param  {Number} offset []
   * @param  {Number} length []
   * @return {}        []
   */
  limit(offset, length) {
    if (offset === undefined) {
      return this;
    }
    if (helper.isArray(offset)) {
      length = offset[1] || length;
      offset = offset[0];
    }
    offset = Math.max(parseInt(offset) || 0, 0);
    if (length) {
      length = Math.max(parseInt(length) || 0, 0);
    }
    this.options.limit = [offset, length];
    return this;
  }
  /**
   * set page options
   * @param  {Number} page     []
   * @param  {} listRows []
   * @return {}          []
   */
  page(page, listRows = this.config.pagesize) {
    if (helper.isArray(page)) {
      listRows = page[1] || listRows;
      page = page[0];
    }
    page = Math.max(parseInt(page) || 1, 1);
    listRows = Math.max(parseInt(listRows) || 10, 1);
    this.options.limit = [listRows * (page - 1), listRows];
    return this;
  }

  /**
   * set tenants options
   */
  tenants(tenantsId) {
    if (!tenantsId) return this;
    const options = this.options;
    const where = { tenants_id: tenantsId };
    if (options.where && helper.isString(options.where)) {
      options.where = { _string: options.where };
    }
    options.where = helper.extend({}, options.where, where);
    return this;
  }
  /**
   * set where options
   * @return {} []
   */
  where(where) {
    if (!where) return this;
    if (helper.isString(where)) {
      where = { _string: where };
    }
    const options = this.options;
    if (options.where && helper.isString(options.where)) {
      options.where = { _string: options.where };
    }
    options.where = helper.extend({}, options.where, where);
    return this;
  }
  /**
   * set field options
   * @param  {String} field   []
   * @param  {Boolean} reverse []
   * @return {}         []
   */
  field(field, reverse = false) {
    if (!field) return this;
    this.options.field = field;
    this.options.fieldReverse = reverse;
    return this;
  }
  /**
   * set field reverse
   * @param  {String} field [field list]
   * @return {Object}       []
   */
  fieldReverse(field) {
    return this.field(field, true);
  }
  /**
   * set table name
   * @param  {String} table []
   * @return {}       []
   */
  table(table, hasPrefix = false) {
    if (!table) return this;
    table = table.trim();
    // table may be a sql, `SELECT * FROM`
    if (!hasPrefix && table.indexOf(' ') === -1) {
      table = this.tablePrefix + table;
    }
    this.options.table = table;
    return this;
  }
  /**
   * union options
   * @param  {} union []
   * @param  {} all   []
   * @return {}       []
   */
  union(union, all = false) {
    if (!union) return this;
    if (!this.options.union) {
      this.options.union = [];
    }
    this.options.union.push({
      union: union,
      all: all
    });
    return this;
  }
  /**
   * join
   * @param  {[type]} join [description]
   * @return {[type]}      [description]
   */
  join(join) {
    if (!join) return this;
    if (!this.options.join) {
      this.options.join = [];
    }
    if (helper.isArray(join)) {
      this.options.join = this.options.join.concat(join);
    } else {
      this.options.join.push(join);
    }
    return this;
  }
  /**
   * set order options
   * @param  {String} value []
   * @return {}       []
   */
  order(value) {
    this.options.order = value;
    return this;
  }
  /**
   * set table alias
   * @param  {String} value []
   * @return {}       []
   */
  alias(value) {
    this.options.alias = value;
    return this;
  }
  /**
   * set having options
   * @param  {String} value []
   * @return {}       []
   */
  having(value) {
    this.options.having = value;
    return this;
  }
  /**
   * set group options
   * @param  {String} value []
   * @return {}       []
   */
  group(value) {
    this.options.group = value;
    return this;
  }
  /**
   * set lock options
   * @param  {String} value []
   * @return {}       []
   */
  lock(value) {
    this.options.lock = value;
    return this;
  }
  /**
   * set auto options
   * @param  {String} value []
   * @return {}       []
   */
  auto(value) {
    this.options.auto = value;
    return this;
  }
  /**
   * set distinct options
   * @param  {String} data []
   * @return {}      []
   */
  distinct(data) {
    this.options.distinct = data;
    if (helper.isString(data)) {
      this.options.field = data;
    }
    return this;
  }
  /**
   * set explain
   * @param  {Boolean} explain []
   * @return {}         []
   */
  explain(explain) {
    this.options.explain = explain;
    return this;
  }
  /**
   * before add
   * @param  {Object} data []
   * @return {}      []
   */
  beforeAdd(data) {
    return data;
  }
  /**
   * after add
   * @param  {} data []
   * @return {}      []
   */
  afterAdd(data) {
    return this[RELATION].afterAdd(data);
  }
  /**
   * before delete
   */
  beforeDelete(options) {
    return options;
  }
  /**
   * after delete
   * @param  {Mixed} data []
   * @return {}      []
   */
  afterDelete(data) {
    return this[RELATION].afterDelete(data);
  }
  /**
   * before update
   * @param  {Mixed} data []
   * @return {}      []
   */
  beforeUpdate(data) {
    return data;
  }
  /**
   * after update
   * @param  {} data    []
   * @return {}         []
   */
  afterUpdate(data) {
    return this[RELATION].afterUpdate(data);
  }
  /**
   * before find
   */
  beforeFind(options) {
    return options;
  }
  /**
   * after find
   * @return {} []
   */
  afterFind(data) {
    return this[RELATION].afterFind(data);
  }
  /**
   * before select
   */
  beforeSelect(options) {
    return options;
  }
  /**
   * after select
   * @param  {Mixed} result []
   * @return {}        []
   */
  afterSelect(data) {
    return this[RELATION].afterSelect(data);
  }
  /**
   * parse options, reset this.options to {}
   * @param {Object} options
   */
  parseOptions(options) {
    var _this = this;

    return _asyncToGenerator(function* () {
      if (helper.isNumber(options) || helper.isString(options)) {
        options += '';
        const where = {
          [_this.pk]: options.indexOf(',') > -1 ? { IN: options } : options
        };
        options = { where };
      }
      options = helper.extend({}, _this.options, options);
      _this.options = {};
      options.table = options.table || _this.tableName;
      options.tablePrefix = _this.tablePrefix;
      options.pk = _this.pk; // add primary key for options
      if (options.field && options.fieldReverse) {
        options.field = yield _this.db().getReverseFields(options.field);
        delete options.fieldReverse;
      }
      return options;
    })();
  }
  /**
   * add data
   * @param {Object} data
   * @param {Object} options
   */
  add(data, options, replace) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      options = yield _this2.parseOptions(options);
      let parsedData = yield _this2.db().parseData(data, false, options.table);
      parsedData = yield _this2.beforeAdd(parsedData, options);
      if (helper.isEmpty(parsedData)) return Promise.reject(new Error('add data is empty'));
      if (replace) {
        options.replace = replace;
      }
      const lastInsertId = yield _this2.db().add(parsedData, options);
      const copyData = Object.assign({}, data, parsedData, { [_this2.pk]: lastInsertId });
      yield _this2.afterAdd(copyData, options);
      return lastInsertId;
    })();
  }

  /**
   * add data when not exist
   * @param  {Object} data       []
   * @param  {Object} where      []
   * @return {}            []
   */
  thenAdd(data, where) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const findData = yield _this3.where(where).find();
      if (!helper.isEmpty(findData)) {
        return { [_this3.pk]: findData[_this3.pk], type: 'exist' };
      }
      const insertId = yield _this3.add(data);
      return { [_this3.pk]: insertId, type: 'add' };
    })();
  }

  /**
   * update data when exist, otherwise add data
   * @return {id}
   */
  thenUpdate(data, where) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      const findData = yield _this4.where(where).find();
      if (helper.isEmpty(findData)) {
        return _this4.add(data);
      }
      yield _this4.where(where).update(data);
      return findData[_this4.pk];
    })();
  }

  /**
   * add multi data
   * @param {Object} data    []
   * @param {} options []
   * @param {} replace []
   */
  addMany(data, options, replace) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      if (!helper.isArray(data) || !helper.isObject(data[0])) {
        return Promise.reject(new Error('data must be an object array'));
      }
      options = yield _this5.parseOptions(options);
      let promises = data.map((() => {
        var _ref = _asyncToGenerator(function* (item) {
          item = yield _this5.db().parseData(item, false, options.table);
          return _this5.beforeAdd(item, options);
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })());
      data = yield Promise.all(promises);
      if (replace) {
        options.replace = replace;
      }
      const insertIds = yield _this5.db().addMany(data, options);
      promises = data.map(function (item, i) {
        item[_this5.pk] = insertIds[i];
        return _this5.afterAdd(item, options);
      });
      yield Promise.all(promises);
      return insertIds;
    })();
  }

  /**
   * delete data
   * @param  {Object} options []
   * @return {Promise}         []
   */
  delete(options) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      options = yield _this6.parseOptions(options);
      options = yield _this6.beforeDelete(options);
      const rows = yield _this6.db().delete(options);
      yield _this6.afterDelete(options);
      return rows;
    })();
  }

  /**
   * update data
   * @param  {Object} data      []
   * @param  {Object} options   []
   * @param  {Boolean} ignoreWhere []
   * @return {Promise}          []
   */
  update(data, options) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      options = yield _this7.parseOptions(options);
      let parsedData = yield _this7.db().parseData(data, true, options.table);
      // check where condition
      if (helper.isEmpty(options.where)) {
        if (parsedData[_this7.pk]) {
          options.where = { [_this7.pk]: parsedData[_this7.pk] };
          delete parsedData[_this7.pk];
        } else {
          return Promise.reject(new Error('miss where condition on update'));
        }
      }
      parsedData = yield _this7.beforeUpdate(parsedData, options);
      // check data is empty
      if (helper.isEmpty(parsedData)) {
        return Promise.reject(new Error(`update data is empty, original data is ${JSON.stringify(data)}`));
      }
      const rows = yield _this7.db().update(parsedData, options);
      const copyData = Object.assign({}, data, parsedData);
      yield _this7.afterUpdate(copyData, options);
      return rows;
    })();
  }

  /**
   * update all data
   * @param  {Array} dataList []
   * @return {Promise}          []
   */
  updateMany(dataList, options) {
    if (!helper.isArray(dataList)) {
      this.options = {};
      return Promise.reject(new Error('updateMany data must be an array'));
    }
    if (!dataList.every(data => data.hasOwnProperty(this.pk))) {
      this.options = {};
      return Promise.reject(new Error('updateMany every data must contain primary key'));
    }
    const promises = dataList.map(data => {
      return this.update(data, options);
    });
    return Promise.all(promises);
  }
  /**
   * find data
   * @return Promise
   */
  find(options) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      options = yield _this8.parseOptions(options);
      options.limit = 1;
      options = yield _this8.beforeFind(options);
      const data = yield _this8.db().select(options);
      return _this8.afterFind(data[0] || {}, options);
    })();
  }
  /**
   * select
   * @return Promise
   */
  select(options) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      options = yield _this9.parseOptions(options);
      options = yield _this9.beforeSelect(options);
      const data = yield _this9.db().select(options);
      return _this9.afterSelect(data, options);
    })();
  }
  /**
   * select add
   * @param  {} options []
   * @return {Promise}         []
   */
  selectAdd(options) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      let promise = Promise.resolve(options);
      const Class = _this10.constructor;
      if (options instanceof Class) {
        promise = options.parseOptions();
      }
      const data = yield Promise.all([_this10.parseOptions(), promise]);
      let fields = data[0].field;
      if (!fields) {
        const schema = yield _this10.db().getSchema();
        fields = Object.keys(schema);
      }
      return _this10.db().selectAdd(fields, data[0].table, data[1]);
    })();
  }
  /**
   * count select
   * @param  options
   * @param  pageFlag
   * @return promise
   */
  countSelect(options, pageFlag) {
    var _this11 = this;

    return _asyncToGenerator(function* () {
      let count;
      if (helper.isBoolean(options)) {
        [options, pageFlag] = [{}, options];
      } else if (helper.isNumber(options)) {
        [count, options] = [options, {}];
      }

      options = yield _this11.parseOptions(options);
      const table = options.alias || _this11.tableName;

      // delete table options avoid error when has alias
      delete options.table;
      // reserve and delete the possible order option
      const order = options.order;
      delete options.order;

      if (!helper.isNumber(count)) {
        _this11.options = options;
        count = yield _this11.count(`${_this11[QUOTE_FIELD](table)}.${_this11.pk}`);
      }

      options.limit = options.limit || [0, _this11.config.pagesize || 10];
      // recover the deleted possible order
      options.order = order;
      const pagesize = options.limit[1];
      // get page options
      const data = { pageSize: pagesize };
      const totalPage = Math.ceil(count / data.pageSize);

      data.currentPage = parseInt(options.limit[0] / options.limit[1] + 1);

      if (helper.isBoolean(pageFlag) && data.currentPage > totalPage) {
        if (pageFlag) {
          data.currentPage = 1;
          options.limit = [0, pagesize];
        } else {
          data.currentPage = totalPage;
          options.limit = [(totalPage - 1) * pagesize, pagesize];
        }
      }
      const result = Object.assign({ count: count, totalPages: totalPage }, data);

      if (options.cache && options.cache.key) {
        options.cache.key += '_count';
      }
      result.data = count ? yield _this11.select(options) : [];
      return result;
    })();
  }
  /**
   * get field data
   * @return {[type]} [description]
   */
  getField(field, one) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      const options = yield _this12.parseOptions({ field });
      if (helper.isNumber(one)) {
        options.limit = one;
      } else if (one === true) {
        options.limit = 1;
      }
      const data = yield _this12.db().select(options);

      const result = {};
      for (const item of data) {
        for (const field in item) {
          if (Array.isArray(result[field])) {
            result[field].push(item[field]);
          } else {
            result[field] = one === true ? item[field] : [item[field]];
          }
        }
      }
      const fields = Object.keys(result);
      // result is empty
      if (fields.length === 0) {
        const multi = field.indexOf(',') > -1 && field.indexOf('(') === -1;
        if (multi) {
          field.split(/\s*,\s*/).forEach(function (item) {
            result[item] = one === true ? undefined : [];
          });
          return result;
        } else {
          return one === true ? undefined : [];
        }
      }
      if (fields.length === 1) {
        return result[fields[0]];
      }
      return result;
    })();
  }
  /**
   * increment field data
   * @return {Promise} []
   */
  increment(field, step = 1) {
    step = parseFloat(step);
    let data = {};
    if (helper.isArray(field)) {
      field.forEach(item => {
        data[item] = ['exp', `${this[QUOTE_FIELD](item)}+${step}`];
      });
    } else if (helper.isObject(field)) {
      for (const key in field) {
        data[key] = ['exp', `${this[QUOTE_FIELD](key)}+${field[key]}`];
      }
    } else {
      data = {
        [field]: ['exp', `${this[QUOTE_FIELD](field)}+${step}`]
      };
    }
    return this.update(data);
  }
  /**
   * decrement field data
   * @return {} []
   */
  decrement(field, step = 1) {
    step = parseFloat(step);
    let data = {};
    if (helper.isArray(field)) {
      field.forEach(item => {
        data[item] = ['exp', `${this[QUOTE_FIELD](item)}-${step}`];
      });
    } else if (helper.isObject(field)) {
      for (const key in field) {
        data[key] = ['exp', `${this[QUOTE_FIELD](key)}-${field[key]}`];
      }
    } else {
      data = {
        [field]: ['exp', `${this[QUOTE_FIELD](field)}-${step}`]
      };
    }
    return this.update(data);
  }
  /**
   * quote field
   * @param {String} field
   */
  [QUOTE_FIELD](field) {
    if (field) return this.db().parseKey(field);
    return '*';
  }
  /**
   * get count
   * @param  {String} field []
   * @return {Promise}       []
   */
  count(field) {
    field = this[QUOTE_FIELD](field);
    return this.getField(`COUNT(${field}) AS think_count`, true);
  }
  /**
   * get sum
   * @param  {String} field []
   * @return {Promise}       []
   */
  sum(field) {
    field = this[QUOTE_FIELD](field);
    return this.getField(`SUM(${field}) AS think_sum`, true);
  }
  /**
   * get min value
   * @param  {String} field []
   * @return {Promise}       []
   */
  min(field) {
    field = this[QUOTE_FIELD](field);
    return this.getField(`MIN(${field}) AS think_min`, true);
  }
  /**
   * get max valud
   * @param  {String} field []
   * @return {Promise}       []
   */
  max(field) {
    field = this[QUOTE_FIELD](field);
    return this.getField(`MAX(${field}) AS think_max`, true);
  }
  /**
   * get value average
   * @param  {String} field []
   * @return {Promise}       []
   */
  avg(field) {
    field = this[QUOTE_FIELD](field);
    return this.getField(`AVG(${field}) AS think_avg`, true);
  }
  /**
   * query
   * @return {Promise} []
   */
  query(sqlOptions) {
    sqlOptions = this.parseSql(sqlOptions);
    return this.db().select(sqlOptions, this.options.cache);
  }
  /**
   * execute sql
   * @param  {[type]} sql   [description]
   * @param  {[type]} parse [description]
   * @return {[type]}       [description]
   */
  execute(sqlOptions) {
    sqlOptions = this.parseSql(sqlOptions);
    return this.db().execute(sqlOptions);
  }
  /**
   * parse sql
   * @return promise [description]
   */
  parseSql(sqlOptions, ...args) {
    if (helper.isString(sqlOptions)) {
      sqlOptions = { sql: sqlOptions };
    }
    if (args.length) {
      sqlOptions.sql = util.format(sqlOptions.sql, ...args);
    }
    // replace table name
    sqlOptions.sql = sqlOptions.sql.replace(/(?:^|\s)__([A-Z]+)__(?:$|\s)/g, (a, b) => {
      if (b === 'TABLE') {
        return ` ${this[QUOTE_FIELD](this.tableName)} `;
      }
      return ` ${this[QUOTE_FIELD](this.tablePrefix + b.toLowerCase())} `;
    });
    return sqlOptions;
  }
  /**
   * set relation
   * @param {String} name
   * @param {Mixed} value
   */
  setRelation(name, value) {
    this[RELATION].setRelation(name, value);
    return this;
  }
  /**
   * start transaction
   * @return {Promise} []
   */
  startTrans(connection) {
    return this.db().startTrans(connection);
  }
  /**
   * commit transcation
   * @return {Promise} []
   */
  commit(connection) {
    return this.db().commit(connection);
  }
  /**
   * rollback transaction
   * @return {Promise} []
   */
  rollback(connection) {
    return this.db().rollback(connection);
  }
  /**
   * transaction exec functions
   * @param  {Function} fn [async exec function]
   * @return {Promise}      []
   */
  transaction(fn, connection) {
    return this.db().transaction(fn, connection);
  }
  /**
   * build select sql
   * @param {Object} options
   * @param {Boolean} noParentheses
   */
  buildSelectSql(options, noParentheses = false) {
    var _this13 = this;

    return _asyncToGenerator(function* () {
      options = yield _this13.parseOptions(options);
      const sql = _this13.db().parser.buildSelectSql(options).trim();
      return noParentheses ? sql : `( ${sql} )`;
    })();
  }
};

module.exports.HAS_ONE = Relation.HAS_ONE;
module.exports.HAS_MANY = Relation.HAS_MANY;
module.exports.BELONG_TO = Relation.BELONG_TO;
module.exports.MANY_TO_MANY = Relation.MANY_TO_MANY;