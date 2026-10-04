package com.pos.app.common.util;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Function;

public final class CsvExportUtil {

    private CsvExportUtil() {
    }

    public static <T> byte[] toCsv(List<String> headers, List<T> rows, Function<T, List<String>> rowMapper) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (OutputStreamWriter writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder().setHeader(headers.toArray(new String[0])).build())) {
            for (T row : rows) {
                printer.printRecord(rowMapper.apply(row));
            }
        }
        return out.toByteArray();
    }
}
