package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum TodoEffort {

    FIFTEEN_MIN("15min"),
    THIRTY_MIN("30min"),
    ONE_HR("1hr"),
    TWO_HR("2hr"),
    FOUR_HR("4hr"),
    EIGHT_HR("8hr");

    private final String value;

    TodoEffort(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static TodoEffort fromValue(String value) {
        if (value == null) return null;
        for (TodoEffort e : values()) {
            if (e.value.equals(value)) return e;
        }
        throw new IllegalArgumentException("Unknown todo effort: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<TodoEffort, String> {
        @Override
        public String convertToDatabaseColumn(TodoEffort effort) {
            return effort != null ? effort.getValue() : null;
        }

        @Override
        public TodoEffort convertToEntityAttribute(String value) {
            return value != null ? TodoEffort.fromValue(value) : null;
        }
    }
}
