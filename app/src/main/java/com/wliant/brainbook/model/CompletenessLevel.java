package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum CompletenessLevel {

    NONE("none"),
    PARTIAL("partial"),
    GOOD("good"),
    COMPLETE("complete");

    private final String value;

    CompletenessLevel(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static CompletenessLevel fromValue(String value) {
        for (CompletenessLevel level : values()) {
            if (level.value.equals(value)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Unknown completeness level: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<CompletenessLevel, String> {

        @Override
        public String convertToDatabaseColumn(CompletenessLevel level) {
            return level != null ? level.getValue() : null;
        }

        @Override
        public CompletenessLevel convertToEntityAttribute(String value) {
            return value != null ? CompletenessLevel.fromValue(value) : null;
        }
    }
}
