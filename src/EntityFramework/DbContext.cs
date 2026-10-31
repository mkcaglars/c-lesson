using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Data.Entity.Core;
using System.Data.Entity.Infrastructure;
using System.Data.Entity.Validation;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text;
using MySql.Data.MySqlClient;

namespace System.Data.Entity
{
    public enum EntityState { Detached = 1, Unchanged = 2, Added = 4, Deleted = 8, Modified = 16 }

    /// <summary>Veritabanı oturumu: tablolara (DbSet) erişim ve değişiklikleri kaydetme.</summary>
    public class DbContext : IDisposable
    {
        internal readonly string connectionString;
        internal readonly List<EntityEntry> entries = new List<EntityEntry>();
        readonly Dictionary<Type, object> sets = new Dictionary<Type, object>();
        bool disposed;

        protected DbContext() : this(null) { }

        protected DbContext(string nameOrConnectionString)
        {
            string name = nameOrConnectionString ?? GetType().Name;
            if (name.StartsWith("name=", StringComparison.OrdinalIgnoreCase)) name = name.Substring(5);
            string cs;
            if (name.Contains('='))
            {
                cs = name;
            }
            else
            {
                var setting = ConfigurationManager.ConnectionStrings[name];
                if (setting == null)
                    throw new InvalidOperationException($"No connection string named '{name}' could be found in the application config file.");
                cs = setting.ConnectionString;
            }
            connectionString = ProviderConnectionString(cs);
            Database = new Database(this);
            // DbSet<T> özelliklerini doldur
            foreach (var p in GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (!p.PropertyType.IsGenericType || p.PropertyType.GetGenericTypeDefinition() != typeof(DbSet<>) || !p.CanWrite) continue;
                var t = p.PropertyType.GetGenericArguments()[0];
                var set = CreateSet(t, p.Name);
                p.SetValue(this, set);
            }
        }

        static string ProviderConnectionString(string cs)
        {
            const string key = "provider connection string=";
            int i = cs.IndexOf(key, StringComparison.OrdinalIgnoreCase);
            if (i < 0) return cs;
            string rest = cs.Substring(i + key.Length).Trim();
            if (rest.StartsWith("\"")) { int j = rest.IndexOf('"', 1); return j > 0 ? rest.Substring(1, j - 1) : rest.Trim('"'); }
            if (rest.StartsWith("'")) { int j = rest.IndexOf('\'', 1); return j > 0 ? rest.Substring(1, j - 1) : rest.Trim('\''); }
            return rest;
        }

        object CreateSet(Type t, string propertyName)
        {
            if (sets.TryGetValue(t, out var s)) return s;
            var set = Activator.CreateInstance(typeof(DbSet<>).MakeGenericType(t), BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public, null, new object[] { this, propertyName }, CultureInfo.InvariantCulture);
            sets[t] = set;
            return set;
        }

        public Database Database { get; }

        public virtual DbSet<TEntity> Set<TEntity>() where TEntity : class => (DbSet<TEntity>)CreateSet(typeof(TEntity), typeof(TEntity).Name);

        protected virtual void OnModelCreating(DbModelBuilder modelBuilder) { }

        internal MySqlConnection Open()
        {
            if (disposed) throw new ObjectDisposedException(GetType().Name, "The operation cannot be completed because the DbContext has been disposed.");
            var c = new MySqlConnection(connectionString);
            c.Open();
            return c;
        }

        internal EntityEntry EntryOf(object entity) => entries.FirstOrDefault(e => ReferenceEquals(e.Entity, entity));

        public DbEntityEntry Entry(object entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            var e = EntryOf(entity) ?? new EntityEntry(this, entity, EntityState.Detached, SetFor(entity.GetType()));
            return new DbEntityEntry(e);
        }

        public DbEntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            var e = EntryOf(entity) ?? new EntityEntry(this, entity, EntityState.Detached, SetFor(entity.GetType()));
            return new DbEntityEntry<TEntity>(e);
        }

        internal IEntitySet SetFor(Type t)
        {
            if (sets.TryGetValue(t, out var s)) return (IEntitySet)s;
            return (IEntitySet)CreateSet(t, t.Name);
        }

        public virtual int SaveChanges()
        {
            // Değişiklikleri bul
            foreach (var e in entries.Where(x => x.State == EntityState.Unchanged)) if (e.IsModified()) e.State = EntityState.Modified;
            var pending = entries.Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
            if (pending.Count == 0) return 0;
            // Doğrulama (NOT NULL / uzunluk)
            var errors = new List<DbEntityValidationResult>();
            foreach (var e in pending.Where(x => x.State != EntityState.Deleted))
            {
                var r = e.Set.Validate(e.Entity);
                if (r != null) errors.Add(r);
            }
            if (errors.Count > 0) throw new DbEntityValidationException("Validation failed for one or more entities. See 'EntityValidationErrors' property for more details.", errors);
            int n = 0;
            using (var conn = Open())
            {
                foreach (var e in pending)
                {
                    try
                    {
                        n += e.Set.Write(conn, e);
                    }
                    catch (MySqlException ex)
                    {
                        throw new DbUpdateException("An error occurred while updating the entries. See the inner exception for details.", new UpdateException("An error occurred while updating the entries. See the inner exception for details.", ex));
                    }
                }
            }
            foreach (var e in pending)
            {
                if (e.State == EntityState.Deleted) { entries.Remove(e); continue; }
                e.State = EntityState.Unchanged;
                e.Snapshot();
            }
            return n;
        }

        public System.Threading.Tasks.Task<int> SaveChangesAsync() => System.Threading.Tasks.Task.FromResult(SaveChanges());

        public void Dispose()
        {
            disposed = true;
            GC.SuppressFinalize(this);
        }

        public DbChangeTracker ChangeTracker => new DbChangeTracker(this);
        public DbContextConfiguration Configuration { get; } = new DbContextConfiguration();
    }

    public sealed class DbContextConfiguration
    {
        public bool LazyLoadingEnabled { get; set; } = true;
        public bool ProxyCreationEnabled { get; set; } = true;
        public bool AutoDetectChangesEnabled { get; set; } = true;
        public bool ValidateOnSaveEnabled { get; set; } = true;
    }

    public sealed class DbChangeTracker
    {
        readonly DbContext ctx;
        internal DbChangeTracker(DbContext ctx) { this.ctx = ctx; }
        public bool HasChanges() => ctx.entries.Any(e => e.State != EntityState.Unchanged || e.IsModified());
        public void DetectChanges() { foreach (var e in ctx.entries.Where(x => x.State == EntityState.Unchanged)) if (e.IsModified()) e.State = EntityState.Modified; }
        public IEnumerable<DbEntityEntry> Entries() => ctx.entries.Select(e => new DbEntityEntry(e)).ToList();
    }

    public sealed class Database
    {
        readonly DbContext ctx;
        internal Database(DbContext ctx) { this.ctx = ctx; }
        public MySqlConnection Connection => new MySqlConnection(ctx.connectionString);
        public bool Exists() { try { using var c = ctx.Open(); return true; } catch (MySqlException) { return false; } }

        public int ExecuteSqlCommand(string sql, params object[] parameters)
        {
            using var c = ctx.Open();
            var cmd = new MySqlCommand(sql, c);
            AddParameters(cmd, parameters);
            return cmd.ExecuteNonQuery();
        }

        internal static void AddParameters(MySqlCommand cmd, object[] parameters)
        {
            if (parameters == null) return;
            for (int i = 0; i < parameters.Length; i++)
            {
                if (parameters[i] is MySqlParameter mp) cmd.Parameters.Add(mp);
                else cmd.Parameters.AddWithValue("@p" + i.ToString(CultureInfo.InvariantCulture), parameters[i]);
            }
        }

        public IEnumerable<T> SqlQuery<T>(string sql, params object[] parameters)
        {
            using var c = ctx.Open();
            var cmd = new MySqlCommand(sql, c);
            AddParameters(cmd, parameters);
            using var r = cmd.ExecuteReader();
            var list = new List<T>();
            bool scalar = typeof(T).IsPrimitive || typeof(T) == typeof(string) || typeof(T) == typeof(decimal) || typeof(T) == typeof(DateTime) || Nullable.GetUnderlyingType(typeof(T)) != null;
            while (r.Read())
            {
                if (scalar) { list.Add((T)Materializer.ConvertTo(r.GetValue(0), typeof(T))); continue; }
                var o = Activator.CreateInstance<T>();
                for (int i = 0; i < r.FieldCount; i++)
                {
                    var p = typeof(T).GetProperty(r.GetName(i), BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);
                    if (p != null && p.CanWrite) p.SetValue(o, Materializer.ConvertTo(r.GetValue(i), p.PropertyType));
                }
                list.Add(o);
            }
            return list;
        }
    }

    public class DbModelBuilder { }

    // ------------------------------------------------------------ varlık kayıtları

    internal sealed class EntityEntry
    {
        public EntityEntry(DbContext ctx, object entity, EntityState state, IEntitySet set) { Context = ctx; Entity = entity; State = state; Set = set; }
        public DbContext Context { get; }
        public object Entity { get; }
        public IEntitySet Set { get; }
        public EntityState State { get; set; }
        public Dictionary<string, object> Original { get; private set; } = new Dictionary<string, object>();

        public void Snapshot() => Original = Set.Values(Entity);

        public bool IsModified()
        {
            var cur = Set.Values(Entity);
            foreach (var kv in cur) if (!Original.TryGetValue(kv.Key, out var o) || !Equals(o, kv.Value)) return true;
            return false;
        }
    }

    public class DbEntityEntry
    {
        internal readonly EntityEntry e;
        internal DbEntityEntry(EntityEntry e) { this.e = e; }
        public object Entity => e.Entity;
        public EntityState State
        {
            get => e.State == EntityState.Unchanged && e.IsModified() ? EntityState.Modified : e.State;
            set
            {
                var ctx = e.Context;
                bool tracked = ctx.entries.Contains(e);
                if (value == EntityState.Detached) { ctx.entries.Remove(e); e.State = EntityState.Detached; return; }
                if (!tracked) { ctx.entries.Add(e); if (value != EntityState.Added) e.Snapshot(); }
                e.State = value;
            }
        }
        public void Reload() { e.Set.Reload(e); }
    }

    public sealed class DbEntityEntry<TEntity> : DbEntityEntry where TEntity : class
    {
        internal DbEntityEntry(EntityEntry e) : base(e) { }
        public new TEntity Entity => (TEntity)e.Entity;
    }

    internal interface IEntitySet
    {
        Dictionary<string, object> Values(object entity);
        int Write(MySqlConnection conn, EntityEntry e);
        DbEntityValidationResult Validate(object entity);
        void Reload(EntityEntry e);
    }

    internal static class Materializer
    {
        public static object ConvertTo(object v, Type t)
        {
            if (v == null || v is DBNull) return t.IsValueType && Nullable.GetUnderlyingType(t) == null ? Activator.CreateInstance(t) : null;
            var u = Nullable.GetUnderlyingType(t) ?? t;
            if (u.IsInstanceOfType(v)) return v;
            if (u == typeof(bool)) return Convert.ToDecimal(v, CultureInfo.InvariantCulture) != 0;
            if (u.IsEnum) return Enum.ToObject(u, v);
            if (u == typeof(TimeSpan)) return TimeSpan.Parse(v.ToString(), CultureInfo.InvariantCulture);
            return Convert.ChangeType(v, u, CultureInfo.InvariantCulture);
        }
    }

    /// <summary>Bir tablonun kayıtları. LINQ sorguları (Where, FirstOrDefault, ToList, join...) doğrudan kullanılabilir.</summary>
    public class DbSet<TEntity> : IEnumerable<TEntity>, IListSource, IEntitySet where TEntity : class
    {
        readonly DbContext ctx;
        readonly string propertyName;
        string table;
        List<ColumnMap> columns;

        sealed class ColumnMap
        {
            public string Column;
            public PropertyInfo Prop;
            public bool Key;
            public bool AutoInc;
            public bool NotNull;
            public int MaxLength;
        }

        internal DbSet(DbContext ctx, string propertyName) { this.ctx = ctx; this.propertyName = propertyName; }

        protected DbSet() { }

        List<ColumnMap> Columns(MySqlConnection conn)
        {
            if (columns != null) return columns;
            // Tablo adı: varlık sınıfının adı, olmazsa DbSet özelliğinin adı
            foreach (var candidate in new[] { typeof(TEntity).Name, propertyName, propertyName.TrimEnd('s') }.Distinct())
            {
                try
                {
                    using var r = new MySqlCommand("SELECT * FROM `" + candidate.Replace("`", "``") + "` LIMIT 0", conn).ExecuteReader();
                    var schema = r.GetSchemaTable();
                    var list = new List<ColumnMap>();
                    foreach (DataRow row in schema.Rows)
                    {
                        string col = (string)row["ColumnName"];
                        var prop = typeof(TEntity).GetProperty(col, BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);
                        if (prop == null || !prop.CanWrite) continue;
                        list.Add(new ColumnMap { Column = col, Prop = prop, Key = (bool)row["IsKey"], AutoInc = (bool)row["IsAutoIncrement"], NotNull = !(bool)row["AllowDBNull"], MaxLength = (int)row["ColumnSize"] });
                    }
                    table = candidate;
                    columns = list;
                    return columns;
                }
                catch (MySqlException ex) when (ex.Number == 1146) { }
            }
            throw new MySqlException($"Table '{conn.Database}.{typeof(TEntity).Name.ToLowerInvariant()}' doesn't exist", 1146);
        }

        IEnumerable<ColumnMap> Keys => columns.Where(c => c.Key);

        object[] KeyOf(object entity) => Keys.Select(c => c.Prop.GetValue(entity)).ToArray();

        static bool KeyEquals(object[] a, object[] b) => a.Length == b.Length && a.Zip(b, (x, y) => Equals(Convert.ToString(x, CultureInfo.InvariantCulture), Convert.ToString(y, CultureInfo.InvariantCulture))).All(z => z);

        TEntity Materialize(MySqlDataReader r, List<ColumnMap> cols)
        {
            var values = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < r.FieldCount; i++) values[r.GetName(i)] = r.GetValue(i);
            object[] key = Keys.Select(c => Materializer.ConvertTo(values[c.Column], c.Prop.PropertyType)).ToArray();
            // Kimlik eşlemesi: aynı kayıt için aynı nesne
            var existing = ctx.entries.FirstOrDefault(e => e.Set == (IEntitySet)this && e.State != EntityState.Added && KeyEquals(KeyOf(e.Entity), key));
            if (existing != null)
            {
                if (existing.State == EntityState.Unchanged && !existing.IsModified()) { Fill(existing.Entity, cols, values); existing.Snapshot(); }
                return (TEntity)existing.Entity;
            }
            var entity = Activator.CreateInstance<TEntity>();
            Fill(entity, cols, values);
            var entry = new EntityEntry(ctx, entity, EntityState.Unchanged, this);
            entry.Snapshot();
            ctx.entries.Add(entry);
            return entity;
        }

        static void Fill(object entity, List<ColumnMap> cols, Dictionary<string, object> values)
        {
            foreach (var c in cols) if (values.TryGetValue(c.Column, out var v)) c.Prop.SetValue(entity, Materializer.ConvertTo(v, c.Prop.PropertyType));
        }

        List<TEntity> Query(string where = null, object[] keyValues = null)
        {
            using var conn = ctx.Open();
            var cols = Columns(conn);
            var cmd = new MySqlCommand("SELECT * FROM `" + table + "`" + (where ?? ""), conn);
            if (keyValues != null) for (int i = 0; i < keyValues.Length; i++) cmd.Parameters.AddWithValue("@k" + i.ToString(CultureInfo.InvariantCulture), keyValues[i]);
            var list = new List<TEntity>();
            using var r = cmd.ExecuteReader();
            while (r.Read()) list.Add(Materialize(r, cols));
            // silinmek üzere işaretlenenler sorguda görünmez
            return list.Where(x => ctx.EntryOf(x)?.State != EntityState.Deleted).ToList();
        }

        public IEnumerator<TEntity> GetEnumerator() => Query().GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        bool IListSource.ContainsListCollection => false;
        IList IListSource.GetList() => Query();

        /// <summary>Bellekteki (izlenen) kayıtlar.</summary>
        public System.Collections.ObjectModel.ObservableCollection<TEntity> Local => new System.Collections.ObjectModel.ObservableCollection<TEntity>(ctx.entries.Where(e => e.Set == (IEntitySet)this && e.State != EntityState.Deleted).Select(e => (TEntity)e.Entity));

        public virtual TEntity Add(TEntity entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            var e = ctx.EntryOf(entity);
            if (e == null) ctx.entries.Add(new EntityEntry(ctx, entity, EntityState.Added, this));
            else if (e.State == EntityState.Deleted) e.State = EntityState.Unchanged;
            return entity;
        }

        public virtual IEnumerable<TEntity> AddRange(IEnumerable<TEntity> entities) { foreach (var x in entities.ToList()) Add(x); return entities; }

        public virtual TEntity Remove(TEntity entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            var e = ctx.EntryOf(entity);
            if (e == null) throw new InvalidOperationException("The object cannot be deleted because it was not found in the ObjectStateManager.");
            if (e.State == EntityState.Added) ctx.entries.Remove(e);
            else e.State = EntityState.Deleted;
            return entity;
        }

        public virtual IEnumerable<TEntity> RemoveRange(IEnumerable<TEntity> entities) { foreach (var x in entities.ToList()) Remove(x); return entities; }

        public virtual TEntity Attach(TEntity entity)
        {
            if (ctx.EntryOf(entity) == null) { var e = new EntityEntry(ctx, entity, EntityState.Unchanged, this); e.Snapshot(); ctx.entries.Add(e); }
            return entity;
        }

        public virtual TEntity Find(params object[] keyValues)
        {
            using (var conn = ctx.Open()) Columns(conn);
            var keys = Keys.ToList();
            if (keyValues == null || keyValues.Length != keys.Count) throw new ArgumentException("The number of primary key values passed must match number of primary key values defined on the entity.", nameof(keyValues));
            var conv = keys.Select((k, i) => Materializer.ConvertTo(keyValues[i], k.Prop.PropertyType)).ToArray();
            var tracked = ctx.entries.FirstOrDefault(e => e.Set == (IEntitySet)this && e.State != EntityState.Deleted && KeyEquals(KeyOf(e.Entity), conv));
            if (tracked != null) return (TEntity)tracked.Entity;
            string where = " WHERE " + string.Join(" AND ", keys.Select((k, i) => "`" + k.Column + "` = @k" + i.ToString(CultureInfo.InvariantCulture)));
            return Query(where, conv).FirstOrDefault();
        }

        public DbSet<TEntity> Include(string path) => this;
        public DbSet<TEntity> AsNoTracking() => this;
        public TEntity Create() => Activator.CreateInstance<TEntity>();

        public IEnumerable<TEntity> SqlQuery(string sql, params object[] parameters)
        {
            using var conn = ctx.Open();
            var cols = Columns(conn);
            var cmd = new MySqlCommand(sql, conn);
            Database.AddParameters(cmd, parameters);
            var list = new List<TEntity>();
            using var r = cmd.ExecuteReader();
            while (r.Read()) list.Add(Materialize(r, cols));
            return list;
        }

        // ---- IEntitySet

        Dictionary<string, object> IEntitySet.Values(object entity)
        {
            if (columns == null) using (var conn = ctx.Open()) Columns(conn);
            return columns.ToDictionary(c => c.Column, c => c.Prop.GetValue(entity));
        }

        DbEntityValidationResult IEntitySet.Validate(object entity)
        {
            if (columns == null) using (var conn = ctx.Open()) Columns(conn);
            var errors = new List<DbValidationError>();
            foreach (var c in columns)
            {
                var v = c.Prop.GetValue(entity);
                if (c.NotNull && !c.AutoInc && v == null) errors.Add(new DbValidationError(c.Prop.Name, $"The {c.Prop.Name} field is required."));
                if (v is string s && c.MaxLength > 0 && c.MaxLength < 65535 && s.Length > c.MaxLength) errors.Add(new DbValidationError(c.Prop.Name, $"The field {c.Prop.Name} must be a string or array type with a maximum length of '{c.MaxLength}'."));
            }
            return errors.Count == 0 ? null : new DbEntityValidationResult(entity, errors);
        }

        int IEntitySet.Write(MySqlConnection conn, EntityEntry e)
        {
            var cols = Columns(conn);
            var t = "`" + table + "`";
            var cmd = new MySqlCommand { Connection = conn };
            int k = 0;
            string P(object v) { string n = "@v" + (k++).ToString(CultureInfo.InvariantCulture); cmd.Parameters.AddWithValue(n, v ?? DBNull.Value); return n; }
            string Where() => " WHERE " + string.Join(" AND ", Keys.Select(c => "`" + c.Column + "` = " + P(e.State == EntityState.Modified && e.Original.TryGetValue(c.Column, out var o) ? o : c.Prop.GetValue(e.Entity))));
            switch (e.State)
            {
                case EntityState.Added:
                {
                    var ins = cols.Where(c => !(c.AutoInc && IsDefault(c.Prop.GetValue(e.Entity)))).ToList();
                    cmd.CommandText = $"INSERT INTO {t} (" + string.Join(", ", ins.Select(c => "`" + c.Column + "`")) + ") VALUES (" + string.Join(", ", ins.Select(c => P(c.Prop.GetValue(e.Entity)))) + ")";
                    int n = cmd.ExecuteNonQuery();
                    var ai = cols.FirstOrDefault(c => c.AutoInc);
                    if (ai != null && IsDefault(ai.Prop.GetValue(e.Entity)) && cmd.LastInsertedId > 0) ai.Prop.SetValue(e.Entity, Materializer.ConvertTo(cmd.LastInsertedId, ai.Prop.PropertyType));
                    return n;
                }
                case EntityState.Modified:
                {
                    var cur = ((IEntitySet)this).Values(e.Entity);
                    var changed = cols.Where(c => !e.Original.TryGetValue(c.Column, out var o) || !Equals(o, cur[c.Column]) || e.Original.Count == 0).ToList();
                    if (changed.Count == 0) return 0;
                    cmd.CommandText = $"UPDATE {t} SET " + string.Join(", ", changed.Select(c => "`" + c.Column + "` = " + P(cur[c.Column]))) + Where();
                    int n = cmd.ExecuteNonQuery();
                    if (n == 0) throw new DbUpdateConcurrencyException("Store update, insert, or delete statement affected an unexpected number of rows (0). Entities may have been modified or deleted since entities were loaded.");
                    return n;
                }
                case EntityState.Deleted:
                {
                    cmd.CommandText = $"DELETE FROM {t}" + Where();
                    int n = cmd.ExecuteNonQuery();
                    if (n == 0) throw new DbUpdateConcurrencyException("Store update, insert, or delete statement affected an unexpected number of rows (0). Entities may have been modified or deleted since entities were loaded.");
                    return n;
                }
            }
            return 0;
        }

        void IEntitySet.Reload(EntityEntry e)
        {
            var key = KeyOf(e.Entity);
            e.State = EntityState.Unchanged;
            e.Snapshot();
            string where = " WHERE " + string.Join(" AND ", Keys.Select((c, i) => "`" + c.Column + "` = @k" + i.ToString(CultureInfo.InvariantCulture)));
            Query(where, key);
        }

        static bool IsDefault(object v) => v == null || (v is IConvertible c && c.GetTypeCode() is >= TypeCode.SByte and <= TypeCode.Decimal && Convert.ToDecimal(v, CultureInfo.InvariantCulture) == 0);
    }
}

namespace System.Data.Entity.Infrastructure
{
    public class UnintentionalCodeFirstException : InvalidOperationException
    {
        public UnintentionalCodeFirstException() : base("The context is being used in Code First mode with code that was generated from an EDMX file for either Database First or Model First development.") { }
    }

    public class DbUpdateException : DataException
    {
        public DbUpdateException(string message, Exception inner) : base(message, inner) { }
    }

    public class DbUpdateConcurrencyException : DbUpdateException
    {
        public DbUpdateConcurrencyException(string message) : base(message, null) { }
    }
}

namespace System.Data.Entity.Core
{
    public class UpdateException : DataException
    {
        public UpdateException(string message, Exception inner) : base(message, inner) { }
    }
}

namespace System.Data.Entity.Validation
{
    public sealed class DbValidationError
    {
        public DbValidationError(string propertyName, string errorMessage) { PropertyName = propertyName; ErrorMessage = errorMessage; }
        public string PropertyName { get; }
        public string ErrorMessage { get; }
    }

    public sealed class DbEntityValidationResult
    {
        public DbEntityValidationResult(object entity, IEnumerable<DbValidationError> errors) { Entity = entity; ValidationErrors = errors.ToList(); }
        public object Entity { get; }
        public ICollection<DbValidationError> ValidationErrors { get; }
        public bool IsValid => ValidationErrors.Count == 0;
    }

    public class DbEntityValidationException : DataException
    {
        public DbEntityValidationException(string message, IEnumerable<DbEntityValidationResult> results) : base(message + " " + string.Join(" ", results.SelectMany(r => r.ValidationErrors).Select(e => e.ErrorMessage))) { EntityValidationErrors = results.ToList(); }
        public IEnumerable<DbEntityValidationResult> EntityValidationErrors { get; }
    }
}
