package com.pos.app.common.config;

import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.boot.model.naming.PhysicalNamingStrategy;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;

import java.util.regex.Pattern;

/**
 * Converts camelCase entity/field names (e.g. "SalesInvoiceItem", "productId",
 * "prodGST") into snake_case table/column names ("sales_invoice_item", "product_id",
 * "prod_gst") — the same behavior Spring Boot normally applies automatically via its
 * own SpringPhysicalNamingStrategy. Written by hand (depending only on Hibernate's own
 * stable API) because that Spring Boot class's exact package/availability turned out
 * to vary across Spring Boot versions and wasn't reliably resolvable.
 *
 * Uses the standard two-pass regex approach so runs of capitals (acronyms like "GST")
 * collapse into one word instead of being split letter-by-letter.
 *
 * Needed here because this app builds its EntityManagerFactory beans manually for
 * multi-tenancy (see MasterDataSourceConfig, TenantDataSourceConfig,
 * TenantProvisioningService), which bypasses Spring Boot's normal auto-configuration
 * that would otherwise apply this automatically.
 */
public class SnakeCasePhysicalNamingStrategy implements PhysicalNamingStrategy {

    // lowercase/digit followed by uppercase: "prodG" -> "prod_G"
    private static final Pattern BOUNDARY_LOWER_TO_UPPER = Pattern.compile("([a-z0-9])([A-Z])");
    // a run of uppercase letters followed by an uppercase+lowercase pair (acronym end):
    // "GSTFoo" -> "GST_Foo"
    private static final Pattern BOUNDARY_ACRONYM_END = Pattern.compile("([A-Z]+)([A-Z][a-z])");

    @Override
    public Identifier toPhysicalCatalogName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        return convert(name);
    }

    @Override
    public Identifier toPhysicalSchemaName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        return convert(name);
    }

    @Override
    public Identifier toPhysicalTableName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        return convert(name);
    }

    @Override
    public Identifier toPhysicalSequenceName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        return convert(name);
    }

    @Override
    public Identifier toPhysicalColumnName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        return convert(name);
    }

    private Identifier convert(Identifier identifier) {
        if (identifier == null) {
            return null;
        }
        String text = identifier.getText();
        String step1 = BOUNDARY_LOWER_TO_UPPER.matcher(text).replaceAll("$1_$2");
        String step2 = BOUNDARY_ACRONYM_END.matcher(step1).replaceAll("$1_$2");
        String result = step2.toLowerCase();
        return Identifier.toIdentifier(result, identifier.isQuoted());
    }
}
