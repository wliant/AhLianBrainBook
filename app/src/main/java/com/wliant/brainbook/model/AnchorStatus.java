package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum AnchorStatus {

    ACTIVE("active"),
    DRIFTED("drifted"),
    ORPHANED("orphaned");

    private final String value;

    AnchorStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static AnchorStatus fromValue(String value) {
        for (AnchorStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown anchor status: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<AnchorStatus, String> {
        @Override
        public String convertToDatabaseColumn(AnchorStatus status) {
            return status != null ? status.getValue() : null;
        }

        @Override
        public AnchorStatus convertToEntityAttribute(String value) {
            return value != null ? AnchorStatus.fromValue(value) : null;
        }
    }
}
