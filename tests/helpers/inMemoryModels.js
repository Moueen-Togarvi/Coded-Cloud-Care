const mongoose = require('mongoose');

function toComparable(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.getTime();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id) return toComparable(value._id);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toRangeNumber(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function getPathValues(input, pathParts) {
  if (!pathParts.length) return [input];
  const [current, ...remaining] = pathParts;

  if (Array.isArray(input)) {
    return input.flatMap((item) => getPathValues(item, pathParts));
  }

  if (input === null || input === undefined) {
    return [undefined];
  }

  return getPathValues(input[current], remaining);
}

function getPathValue(input, path) {
  const values = getPathValues(input, String(path || '').split('.'));
  return values.length ? values[0] : undefined;
}

function hasOperatorKeys(obj) {
  return isPlainObject(obj) && Object.keys(obj).some((key) => key.startsWith('$'));
}

function buildRegex(condition) {
  if (condition.$regex instanceof RegExp) return condition.$regex;
  if (condition.$regex === undefined) return null;
  const pattern = String(condition.$regex || '');
  const flags = condition.$options ? String(condition.$options) : '';
  return new RegExp(pattern, flags);
}

function evaluateExpr(doc, expr) {
  if (!isPlainObject(expr)) return true;

  const evaluatePair = (arr) => {
    if (!Array.isArray(arr) || arr.length < 2) return [NaN, NaN];
    const left = typeof arr[0] === 'string' && arr[0].startsWith('$') ? getPathValue(doc, arr[0].slice(1)) : arr[0];
    const right = typeof arr[1] === 'string' && arr[1].startsWith('$') ? getPathValue(doc, arr[1].slice(1)) : arr[1];
    return [toRangeNumber(left), toRangeNumber(right)];
  };

  if ('$lte' in expr) {
    const [left, right] = evaluatePair(expr.$lte);
    return Number.isFinite(left) && Number.isFinite(right) && left <= right;
  }
  if ('$gte' in expr) {
    const [left, right] = evaluatePair(expr.$gte);
    return Number.isFinite(left) && Number.isFinite(right) && left >= right;
  }
  if ('$lt' in expr) {
    const [left, right] = evaluatePair(expr.$lt);
    return Number.isFinite(left) && Number.isFinite(right) && left < right;
  }
  if ('$gt' in expr) {
    const [left, right] = evaluatePair(expr.$gt);
    return Number.isFinite(left) && Number.isFinite(right) && left > right;
  }

  return true;
}

function matchCondition(docValue, condition) {
  if (condition instanceof RegExp) {
    return condition.test(String(docValue || ''));
  }

  if (isPlainObject(condition) && hasOperatorKeys(condition)) {
    if ('$in' in condition) {
      const list = Array.isArray(condition.$in) ? condition.$in : [condition.$in];
      const inList = list.some((item) => toComparable(item) === toComparable(docValue));
      if (!inList) return false;
    }

    if ('$ne' in condition) {
      if (toComparable(docValue) === toComparable(condition.$ne)) return false;
    }

    if ('$exists' in condition) {
      const exists = docValue !== undefined;
      if (Boolean(condition.$exists) !== exists) return false;
    }

    if ('$regex' in condition) {
      const regex = buildRegex(condition);
      if (!regex || !regex.test(String(docValue || ''))) return false;
    }

    if ('$gte' in condition || '$lte' in condition || '$gt' in condition || '$lt' in condition) {
      const value = toRangeNumber(docValue);
      if (!Number.isFinite(value)) return false;
      if ('$gte' in condition && value < toRangeNumber(condition.$gte)) return false;
      if ('$lte' in condition && value > toRangeNumber(condition.$lte)) return false;
      if ('$gt' in condition && value <= toRangeNumber(condition.$gt)) return false;
      if ('$lt' in condition && value >= toRangeNumber(condition.$lt)) return false;
    }

    return true;
  }

  return toComparable(docValue) === toComparable(condition);
}

function matches(doc, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or' && Array.isArray(value)) {
      return value.some((subQuery) => matches(doc, subQuery));
    }
    if (key === '$and' && Array.isArray(value)) {
      return value.every((subQuery) => matches(doc, subQuery));
    }
    if (key === '$expr') {
      return evaluateExpr(doc, value);
    }

    const values = getPathValues(doc, String(key).split('.'));
    if (!values.length) return false;

    if (isPlainObject(value) && '$ne' in value && Object.keys(value).length === 1) {
      return values.every((item) => matchCondition(item, value));
    }

    return values.some((item) => matchCondition(item, value));
  });
}

class QueryArray {
  constructor(items) {
    this.items = Array.isArray(items) ? [...items] : [];
  }

  sort(spec = {}) {
    const entries = Object.entries(spec);
    this.items.sort((a, b) => {
      for (const [key, dir] of entries) {
        const va = getPathValue(a, key);
        const vb = getPathValue(b, key);
        const av = va instanceof Date ? va.getTime() : va;
        const bv = vb instanceof Date ? vb.getTime() : vb;
        if (av === bv) continue;
        return av > bv ? dir : -dir;
      }
      return 0;
    });
    return this;
  }

  skip(count = 0) {
    const n = Math.max(Number(count) || 0, 0);
    this.items = this.items.slice(n);
    return this;
  }

  limit(count = 0) {
    const n = Math.max(Number(count) || 0, 0);
    if (n > 0) this.items = this.items.slice(0, n);
    return this;
  }

  select() {
    return this;
  }

  populate() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.items).then(resolve, reject);
  }

  catch(reject) {
    return Promise.resolve(this.items).catch(reject);
  }
}

class QuerySingle {
  constructor(item) {
    this.item = item || null;
  }

  select() {
    return this;
  }

  populate() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.item).then(resolve, reject);
  }

  catch(reject) {
    return Promise.resolve(this.item).catch(reject);
  }
}

function runAggregate(docs, pipeline = []) {
  let rows = [...docs];

  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter((doc) => matches(doc, stage.$match));
      continue;
    }

    if (stage.$unwind) {
      const rawPath = typeof stage.$unwind === 'string' ? stage.$unwind : stage.$unwind.path;
      const path = String(rawPath || '').replace(/^\$/, '');
      const flattened = [];
      for (const doc of rows) {
        const arr = Array.isArray(doc[path]) ? doc[path] : [];
        if (!arr.length) continue;
        for (const item of arr) {
          flattened.push({ ...doc, [path]: item });
        }
      }
      rows = flattened;
      continue;
    }

    if (stage.$count) {
      const field = stage.$count;
      rows = [{ [field]: rows.length }];
      continue;
    }

    if (stage.$group) {
      const buckets = new Map();
      const idExpr = stage.$group._id;

      for (const row of rows) {
        const groupId = typeof idExpr === 'string' && idExpr.startsWith('$')
          ? getPathValue(row, idExpr.slice(1))
          : (idExpr ?? null);
        const key = JSON.stringify(groupId);

        if (!buckets.has(key)) {
          const init = { _id: groupId };
          for (const [field, expr] of Object.entries(stage.$group)) {
            if (field === '_id') continue;
            if (isPlainObject(expr) && '$sum' in expr) init[field] = 0;
          }
          buckets.set(key, init);
        }

        const group = buckets.get(key);
        for (const [field, expr] of Object.entries(stage.$group)) {
          if (field === '_id') continue;
          if (isPlainObject(expr) && '$sum' in expr) {
            const sumRef = expr.$sum;
            let increment = 0;
            if (typeof sumRef === 'string' && sumRef.startsWith('$')) {
              increment = Number(getPathValue(row, sumRef.slice(1)) || 0);
            } else {
              increment = Number(sumRef || 0);
            }
            group[field] += increment;
          }
        }
      }

      rows = [...buckets.values()];
    }
  }

  return rows;
}

function ensureDefaults(doc = {}) {
  const normalized = { ...doc };
  if (!normalized._id) normalized._id = new mongoose.Types.ObjectId().toString();
  if (!normalized.createdAt) normalized.createdAt = new Date();
  if (!normalized.updatedAt) normalized.updatedAt = new Date();
  if (normalized.isActive === undefined) normalized.isActive = true;
  if ('amount' in normalized && normalized.paymentMethod && !normalized.paymentDate) {
    normalized.paymentDate = new Date(normalized.createdAt);
  }
  if ('source' in normalized && !normalized.date) {
    normalized.date = new Date(normalized.createdAt);
  }
  if ('expenseNumber' in normalized && !normalized.date) {
    normalized.date = new Date(normalized.createdAt);
  }
  if ('medicineId' in normalized && 'quantity' in normalized && !normalized.saleDate) {
    normalized.saleDate = new Date(normalized.createdAt);
  }
  if ('supplierId' in normalized && Array.isArray(normalized.items) && !normalized.orderDate) {
    normalized.orderDate = new Date(normalized.createdAt);
  }
  if ('paidAmount' in normalized && !Array.isArray(normalized.paymentHistory)) {
    normalized.paymentHistory = [];
  }
  return normalized;
}

function attachDocumentMethods(doc, docs) {
  if (!doc || typeof doc !== 'object') return doc;

  if (typeof doc.save !== 'function') {
    Object.defineProperty(doc, 'save', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: async function save() {
        if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
        if (!this.createdAt) this.createdAt = new Date();
        this.updatedAt = new Date();

        const index = docs.findIndex((item) => toComparable(item._id) === toComparable(this._id));
        if (index === -1) {
          docs.push(this);
        } else {
          docs[index] = this;
        }
        return this;
      },
    });
  }

  if (typeof doc.populate !== 'function') {
    Object.defineProperty(doc, 'populate', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: async function populate() {
        return this;
      },
    });
  }

  return doc;
}

function queryToUpsertSeed(query = {}) {
  const seed = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('$')) continue;
    if (hasOperatorKeys(value)) continue;
    seed[key] = value;
  }
  return seed;
}

function applyUpdate(target, update = {}) {
  if (!isPlainObject(update)) return;

  if (update.$set) {
    Object.assign(target, update.$set);
  }
  if (update.$inc) {
    for (const [key, amount] of Object.entries(update.$inc)) {
      target[key] = Number(target[key] || 0) + Number(amount || 0);
    }
  }
  if (update.$push) {
    for (const [key, item] of Object.entries(update.$push)) {
      if (!Array.isArray(target[key])) target[key] = [];
      target[key].push(item);
    }
  }

  if (!update.$set && !update.$inc && !update.$push) {
    Object.assign(target, update);
  }
}

function createInMemoryModel(initial = []) {
  const docs = [];
  for (const item of initial) {
    docs.push(ensureDefaults(item));
  }
  docs.forEach((doc) => attachDocumentMethods(doc, docs));

  function Model(payload = {}) {
    if (!(this instanceof Model)) return new Model(payload);
    Object.assign(this, ensureDefaults(payload));
    attachDocumentMethods(this, docs);
  }

  Model.__data = docs;

  Model.countDocuments = async (query = {}) => docs.filter((doc) => matches(doc, query)).length;

  Model.aggregate = async (pipeline = []) => runAggregate(docs, pipeline);

  Model.find = (query = {}) => {
    const items = docs.filter((doc) => matches(doc, query)).map((doc) => attachDocumentMethods(doc, docs));
    return new QueryArray(items);
  };

  Model.findOne = (query = {}) => {
    const item = docs.find((doc) => matches(doc, query));
    return new QuerySingle(item ? attachDocumentMethods(item, docs) : null);
  };

  Model.findById = (id) => {
    const item = docs.find((doc) => toComparable(doc._id) === toComparable(id));
    return new QuerySingle(item ? attachDocumentMethods(item, docs) : null);
  };

  Model.create = async (payload = {}) => {
    const doc = new Model(payload);
    await doc.save();
    return doc;
  };

  Model.findOneAndUpdate = (query = {}, update = {}, options = {}) => {
    let item = docs.find((doc) => matches(doc, query));
    let before = item ? { ...item } : null;

    if (!item && options.upsert) {
      item = ensureDefaults(queryToUpsertSeed(query));
      docs.push(item);
      attachDocumentMethods(item, docs);
      before = null;
    }

    if (!item) {
      return new QuerySingle(null);
    }

    applyUpdate(item, update);
    item.updatedAt = new Date();
    attachDocumentMethods(item, docs);

    return new QuerySingle(options.new ? item : before);
  };

  Model.findByIdAndUpdate = (id, update = {}, options = {}) => {
    return Model.findOneAndUpdate({ _id: id }, update, options);
  };

  Model.updateOne = async (query = {}, update = {}) => {
    const item = docs.find((doc) => matches(doc, query));
    if (!item) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(item, update);
    item.updatedAt = new Date();
    attachDocumentMethods(item, docs);
    return { matchedCount: 1, modifiedCount: 1 };
  };

  return Model;
}

function createQuickInvoiceTenantModels(seed = {}) {
  return {
    Patient: createInMemoryModel(seed.patients || []),
    Inventory: createInMemoryModel(seed.inventory || []),
    Invoice: createInMemoryModel(seed.invoices || []),
    Payment: createInMemoryModel(seed.payments || []),
    Revenue: createInMemoryModel(seed.revenues || []),
  };
}

function createLabTenantModels(seed = {}) {
  return {
    Patient: createInMemoryModel(seed.patients || []),
    LabTest: createInMemoryModel(seed.labTests || []),
    LabOrder: createInMemoryModel(seed.labOrders || []),
    LabReport: createInMemoryModel(seed.labReports || []),
    Invoice: createInMemoryModel(seed.invoices || []),
    Payment: createInMemoryModel(seed.payments || []),
    Revenue: createInMemoryModel(seed.revenues || []),
  };
}

function createCoreTenantModels(seed = {}) {
  return {
    Patient: createInMemoryModel(seed.patients || []),
    Appointment: createInMemoryModel(seed.appointments || []),
    Staff: createInMemoryModel(seed.staff || []),
    Settings: createInMemoryModel(seed.settings || []),
  };
}

function createPharmacyTenantModels(seed = {}) {
  return {
    Inventory: createInMemoryModel(seed.inventory || []),
    Sale: createInMemoryModel(seed.sales || []),
    Supplier: createInMemoryModel(seed.suppliers || []),
    StockMovement: createInMemoryModel(seed.stockMovements || []),
    PurchaseOrder: createInMemoryModel(seed.purchaseOrders || []),
    Revenue: createInMemoryModel(seed.revenues || []),
  };
}

function createAccountingTenantModels(seed = {}) {
  return {
    Invoice: createInMemoryModel(seed.invoices || []),
    Payment: createInMemoryModel(seed.payments || []),
    Revenue: createInMemoryModel(seed.revenues || []),
    Expense: createInMemoryModel(seed.expenses || []),
    TaxRecord: createInMemoryModel(seed.taxRecords || []),
  };
}

function createFullTenantModels(seed = {}) {
  return {
    Patient: createInMemoryModel(seed.patients || []),
    Appointment: createInMemoryModel(seed.appointments || []),
    Staff: createInMemoryModel(seed.staff || []),
    Settings: createInMemoryModel(seed.settings || []),
    Inventory: createInMemoryModel(seed.inventory || []),
    Sale: createInMemoryModel(seed.sales || []),
    Supplier: createInMemoryModel(seed.suppliers || []),
    StockMovement: createInMemoryModel(seed.stockMovements || []),
    PurchaseOrder: createInMemoryModel(seed.purchaseOrders || []),
    Invoice: createInMemoryModel(seed.invoices || []),
    Payment: createInMemoryModel(seed.payments || []),
    Revenue: createInMemoryModel(seed.revenues || []),
    Expense: createInMemoryModel(seed.expenses || []),
    TaxRecord: createInMemoryModel(seed.taxRecords || []),
    LabTest: createInMemoryModel(seed.labTests || []),
    LabOrder: createInMemoryModel(seed.labOrders || []),
    LabReport: createInMemoryModel(seed.labReports || []),
  };
}

module.exports = {
  createInMemoryModel,
  createCoreTenantModels,
  createPharmacyTenantModels,
  createAccountingTenantModels,
  createFullTenantModels,
  createQuickInvoiceTenantModels,
  createLabTenantModels,
};
