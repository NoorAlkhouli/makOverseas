import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

import chatService from "@/src/services/api/chatService";
import employeeService from "@/src/services/api/employeeService";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
    getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";

const CUSTOMER_PHONE_REGEX = /^[0-9+]+$/;
const CUSTOMER_SEARCH_DEBOUNCE_MS = 450;

const getNestedValue = (object, paths = [], fallback = null) => {
    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], object);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return fallback;
};

const normalizeId = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        return null;
    }

    return String(value);
};

const getSafeText = (value, fallback = "") => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "object") {
        return String(
            value?.name ||
            value?.title ||
            value?.full_name ||
            value?.description ||
            fallback ||
            ""
        );
    }

    return String(value);
};

const normalizeAvatarUrl = (value) => {
    if (!value) return null;

    if (typeof value === "string") {
        const cleanValue = value.trim();
        return cleanValue.length > 0 ? cleanValue : null;
    }

    if (typeof value === "object") {
        return normalizeAvatarUrl(
            value.url ||
            value.path ||
            value.src ||
            value.full_url ||
            value.fullUrl ||
            value.preview_url ||
            value.previewUrl
        );
    }

    return null;
};

const getItemsFromResponse = (response) => {
    const data =
        response?.data?.data ||
        response?.data?.items ||
        response?.data?.employees ||
        response?.data?.customers ||
        response?.data ||
        response?.items ||
        response?.employees ||
        response?.customers ||
        response;

    if (!Array.isArray(data)) {
        return [];
    }

    const flattenedItems = [];

    data.forEach((item) => {
        const nestedItems =
            item?.employees ||
            item?.users ||
            item?.members ||
            item?.items ||
            item?.data ||
            null;

        if (Array.isArray(nestedItems)) {
            nestedItems.forEach((nestedItem) => {
                flattenedItems.push({
                    ...nestedItem,
                    department:
                        nestedItem?.department ||
                        item?.department ||
                        {
                            id: item?.id,
                            name: item?.name || item?.title,
                            description: item?.description,
                        },
                });
            });
        } else {
            flattenedItems.push(item);
        }
    });

    return flattenedItems;
};

const getMemberAvatar = (source) => {
    const avatarPaths = [
        "avatar",
        "image",
        "photo",
        "profile_photo",
        "profilePhoto",
        "avatar_url",
        "avatarUrl",
        "user.avatar",
        "user.image",
        "user.photo",
        "user.profile_photo",
        "user.profilePhoto",
        "user.avatar_url",
        "user.avatarUrl",
        "profile.avatar",
        "profile.image",
        "profile.photo",
        "profile.avatar_url",
        "profile.avatarUrl",
    ];

    for (const path of avatarPaths) {
        const value = getNestedValue(source, [path], null);
        const avatar = normalizeAvatarUrl(value);

        if (avatar) {
            return avatar;
        }
    }

    return null;
};

const getMemberInitials = (name = "") => {
    const initials = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return initials || "MO";
};

const normalizeMember = (item, type = "employee", isArabic = false) => {
    const userId = normalizeId(
        item?.user_id ||
        item?.userId ||
        item?.user?.id ||
        item?.profile?.user_id ||
        item?.profile?.id ||
        item?.id
    );

    if (!userId) {
        return null;
    }

    const name = getSafeText(
        getNestedValue(
            item,
            [
                "full_name",
                "fullName",
                "name",
                "display_name",
                "displayName",
                "user.full_name",
                "user.fullName",
                "user.name",
                "profile.full_name",
                "profile.fullName",
                "profile.name",
            ],
            type === "customer"
                ? isArabic
                    ? "عميل"
                    : "Customer"
                : isArabic
                    ? "موظف"
                    : "Employee"
        )
    );

    const subtitle = getSafeText(
        getNestedValue(
            item,
            [
                "department.name",
                "department.title",
                "department_name",
                "department",
                "phone",
                "phone_number",
                "phoneNumber",
                "mobile",
                "user.phone",
                "user.phone_number",
                "profile.phone",
            ],
            type === "customer"
                ? isArabic
                    ? "عميل"
                    : "Customer"
                : isArabic
                    ? "موظف"
                    : "Employee"
        )
    );

    return {
        key: `${type}-${userId}`,
        id: userId,
        userId,
        type,
        name,
        subtitle,
        avatar: getMemberAvatar(item),
        raw: item,
    };
};

const uniqueMembers = (members = []) => {
    const seenIds = new Set();

    return members.filter((member) => {
        if (!member?.userId) {
            return false;
        }

        const key = String(member.userId);

        if (seenIds.has(key)) {
            return false;
        }

        seenIds.add(key);
        return true;
    });
};

export default function CreateGroupChatModal({
    visible,
    colors,
    isArabic = false,
    onClose,
    onCreated,
}) {
    const { height: screenHeight } = useWindowDimensions();
    const [groupTitle, setGroupTitle] = useState("");
    const [employeeMembers, setEmployeeMembers] = useState([]);
    const [customerMembers, setCustomerMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const customerSearchTimerRef = useRef(null);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const modalTopGap = Platform.OS === "ios" ? 64 : 34;
    const modalBottomGap = keyboardHeight > 0
        ? keyboardHeight + (Platform.OS === "ios" ? 8 : 10)
        : Platform.OS === "ios"
            ? 22
            : 14;
    const modalMaxHeight = Math.max(
        320,
        screenHeight - modalTopGap - modalBottomGap
    );

    const cleanCustomerSearch = customerSearch.trim();
    const isValidCustomerSearch =
        cleanCustomerSearch.length >= 3 &&
        cleanCustomerSearch.length <= 20 &&
        CUSTOMER_PHONE_REGEX.test(cleanCustomerSearch);

    const selectedIds = useMemo(
        () => new Set(selectedMembers.map((member) => String(member.userId))),
        [selectedMembers]
    );

    const isCreateDisabled =
        isCreating ||
        groupTitle.trim().length < 2 ||
        selectedMembers.length === 0;

    const text = {
        title: isArabic ? "إنشاء مجموعة" : "Create group",
        subtitle: isArabic
            ? "اختر الأعضاء واكتب اسم المجموعة."
            : "Choose members and enter a group name.",
        groupName: isArabic ? "اسم المجموعة" : "Group name",
        groupNamePlaceholder: isArabic
            ? "مثال: Air Freight - Order 1842"
            : "Example: Air Freight - Order 1842",
        employees: isArabic ? "الموظفون" : "Employees",
        customers: isArabic ? "العملاء" : "Customers",
        customerSearch: isArabic ? "بحث عن عميل بالهاتف" : "Search customer by phone",
        selected: isArabic ? "الأعضاء المحددون" : "Selected members",
        noSelected: isArabic ? "لم يتم اختيار أعضاء بعد" : "No members selected yet",
        create: isArabic ? "إنشاء المجموعة" : "Create group",
        creating: isArabic ? "جاري الإنشاء..." : "Creating...",
        cancel: isArabic ? "إلغاء" : "Cancel",
        loadingEmployees: isArabic ? "جاري تحميل الموظفين..." : "Loading employees...",
        noEmployees: isArabic ? "لا يوجد موظفون متاحون." : "No employees available.",
        searchHint: isArabic ? "اكتب 3 أرقام على الأقل." : "Enter at least 3 digits.",
        searchingCustomers: isArabic ? "جاري البحث عن العملاء..." : "Searching customers...",
        noCustomers: isArabic ? "لا يوجد عملاء بهذا الرقم." : "No customers found.",
        requiredTitle: isArabic ? "اسم المجموعة مطلوب." : "Group name is required.",
        requiredMembers: isArabic ? "اختر عضو واحد على الأقل." : "Choose at least one member.",
        createError: isArabic
            ? "تعذر إنشاء المجموعة. حاول مرة ثانية."
            : "Could not create the group. Please try again.",
    };


    useEffect(() => {
        if (!visible) {
            setKeyboardHeight(0);
            return undefined;
        }

        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event?.endCoordinates?.height || 0);
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [visible]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        let isMounted = true;

        const loadEmployees = async () => {
            try {
                setIsLoadingEmployees(true);
                setErrorMessage("");

                const response = await employeeService.listEmployees();
                const normalizedEmployees = uniqueMembers(
                    getItemsFromResponse(response)
                        .map((item) => normalizeMember(item, "employee", isArabic))
                        .filter(Boolean)
                );

                if (isMounted) {
                    setEmployeeMembers(normalizedEmployees);
                }
            } catch (error) {
                console.log("Load group employees error:", error?.raw || error);

                if (isMounted) {
                    setEmployeeMembers([]);
                    setErrorMessage(
                        error?.userMessage ||
                        (isArabic
                            ? "تعذر تحميل الموظفين."
                            : "Could not load employees.")
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingEmployees(false);
                }
            }
        };

        loadEmployees();

        return () => {
            isMounted = false;
        };
    }, [visible, isArabic]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        if (customerSearchTimerRef.current) {
            clearTimeout(customerSearchTimerRef.current);
            customerSearchTimerRef.current = null;
        }

        if (!cleanCustomerSearch || !isValidCustomerSearch) {
            setCustomerMembers([]);
            setIsSearchingCustomers(false);
            return;
        }

        let isCancelled = false;

        setIsSearchingCustomers(true);

        customerSearchTimerRef.current = setTimeout(async () => {
            try {
                const response = await chatService.searchCustomers(cleanCustomerSearch);
                const normalizedCustomers = uniqueMembers(
                    getItemsFromResponse(response)
                        .map((item) => normalizeMember(item, "customer", isArabic))
                        .filter(Boolean)
                );

                if (!isCancelled) {
                    setCustomerMembers(normalizedCustomers);
                }
            } catch (error) {
                console.log("Search group customers error:", error?.raw || error);

                if (!isCancelled) {
                    setCustomerMembers([]);
                }
            } finally {
                if (!isCancelled) {
                    setIsSearchingCustomers(false);
                }
            }
        }, CUSTOMER_SEARCH_DEBOUNCE_MS);

        return () => {
            isCancelled = true;

            if (customerSearchTimerRef.current) {
                clearTimeout(customerSearchTimerRef.current);
                customerSearchTimerRef.current = null;
            }
        };
    }, [visible, cleanCustomerSearch, isValidCustomerSearch, isArabic]);

    const resetForm = () => {
        setGroupTitle("");
        setCustomerSearch("");
        setCustomerMembers([]);
        setSelectedMembers([]);
        setErrorMessage("");
    };

    const handleClose = () => {
        if (isCreating) {
            return;
        }

        Keyboard.dismiss();
        resetForm();
        onClose?.();
    };

    const toggleMember = (member) => {
        if (!member?.userId || isCreating) {
            return;
        }

        setSelectedMembers((currentMembers) => {
            const exists = currentMembers.some(
                (item) => String(item.userId) === String(member.userId)
            );

            if (exists) {
                return currentMembers.filter(
                    (item) => String(item.userId) !== String(member.userId)
                );
            }

            return [...currentMembers, member];
        });
    };

    const removeSelectedMember = (member) => {
        if (!member?.userId || isCreating) {
            return;
        }

        setSelectedMembers((currentMembers) =>
            currentMembers.filter(
                (item) => String(item.userId) !== String(member.userId)
            )
        );
    };

    const handleCreateGroup = async () => {
        const title = groupTitle.trim();

        if (!title) {
            setErrorMessage(text.requiredTitle);
            return;
        }

        if (selectedMembers.length === 0) {
            setErrorMessage(text.requiredMembers);
            return;
        }

        const participantIds = uniqueMembers(selectedMembers)
            .map((member) => Number(member.userId))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (participantIds.length === 0) {
            setErrorMessage(text.requiredMembers);
            return;
        }

        try {
            setIsCreating(true);
            setErrorMessage("");
            Keyboard.dismiss();

            const response = await chatService.createConversation({
                type: "group",
                title,
                participant_ids: participantIds,
            });

            resetForm();
            await onCreated?.(response);
        } catch (error) {
            console.log("Create group conversation error:", error?.raw || error);
            setErrorMessage(error?.userMessage || text.createError);
        } finally {
            setIsCreating(false);
        }
    };

    const renderMemberRow = (member) => {
        const selected = selectedIds.has(String(member.userId));

        return (
            <TouchableOpacity
                key={member.key}
                style={[
                    styles.memberRow,
                    getRowDirectionStyle(isArabic),
                    selected && styles.memberRowSelected,
                ]}
                activeOpacity={0.85}
                onPress={() => toggleMember(member)}
                disabled={isCreating}
            >
                <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                        {getMemberInitials(member.name)}
                    </Text>
                </View>

                <View style={styles.memberInfo}>
                    <Text
                        style={[
                            styles.memberName,
                            getTextDirectionStyle(isArabic),
                        ]}
                        numberOfLines={1}
                    >
                        {member.name}
                    </Text>

                    {!!member.subtitle && (
                        <Text
                            style={[
                                styles.memberSubtitle,
                                getTextDirectionStyle(isArabic),
                            ]}
                            numberOfLines={1}
                        >
                            {member.subtitle}
                        </Text>
                    )}
                </View>

                <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                    {selected && (
                        <Feather
                            name="check"
                            size={15}
                            color={colors.darkText || colors.background}
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="overFullScreen"
        >
            <Pressable
                style={[
                    styles.overlay,
                    {
                        backgroundColor: colors.overlay || colors.modalOverlay,
                        paddingTop: modalTopGap,
                        paddingBottom: modalBottomGap,
                    },
                ]}
                onPress={handleClose}
            >
                <Pressable
                    style={[styles.card, { maxHeight: modalMaxHeight }]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={[styles.header, getRowDirectionStyle(isArabic)]}>
                        <View style={styles.headerTextWrapper}>
                            <Text
                                style={[
                                    styles.title,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.title}
                            </Text>

                            <Text
                                style={[
                                    styles.subtitle,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.subtitle}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.closeButton}
                            activeOpacity={0.85}
                            onPress={handleClose}
                            disabled={isCreating}
                        >
                            <Feather name="x" size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={styles.bodyContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        automaticallyAdjustKeyboardInsets={false}
                    >
                        <Text
                            style={[
                                styles.label,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {text.groupName}
                        </Text>

                        <TextInput
                            value={groupTitle}
                            onChangeText={setGroupTitle}
                            placeholder={text.groupNamePlaceholder}
                            placeholderTextColor={colors.textMuted}
                            style={[
                                styles.input,
                                getTextInputDirectionFromValue(groupTitle, isArabic),
                            ]}
                            editable={!isCreating}
                            returnKeyType="done"
                        />

                        <View style={[styles.sectionHeader, getRowDirectionStyle(isArabic)]}>
                            <Text
                                style={[
                                    styles.sectionTitle,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.selected}
                            </Text>

                            <Text style={styles.counterText}>{selectedMembers.length}</Text>
                        </View>

                        {selectedMembers.length > 0 ? (
                            <View style={[styles.selectedChips, getRowDirectionStyle(isArabic)]}>
                                {selectedMembers.map((member) => (
                                    <TouchableOpacity
                                        key={`selected-${member.key}`}
                                        style={[styles.selectedChip, getRowDirectionStyle(isArabic)]}
                                        activeOpacity={0.85}
                                        onPress={() => removeSelectedMember(member)}
                                        disabled={isCreating}
                                    >
                                        <Text style={styles.selectedChipText} numberOfLines={1}>
                                            {member.name}
                                        </Text>

                                        <Feather name="x" size={14} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <Text
                                style={[
                                    styles.emptyText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.noSelected}
                            </Text>
                        )}

                        <View style={styles.divider} />

                        <Text
                            style={[
                                styles.sectionTitle,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {text.employees}
                        </Text>

                        {isLoadingEmployees ? (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingText}>{text.loadingEmployees}</Text>
                            </View>
                        ) : employeeMembers.length > 0 ? (
                            employeeMembers.map(renderMemberRow)
                        ) : (
                            <Text
                                style={[
                                    styles.emptyText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.noEmployees}
                            </Text>
                        )}

                        <View style={styles.divider} />

                        <Text
                            style={[
                                styles.sectionTitle,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {text.customers}
                        </Text>

                        <TextInput
                            value={customerSearch}
                            onChangeText={setCustomerSearch}
                            placeholder={text.customerSearch}
                            placeholderTextColor={colors.textMuted}
                            style={[
                                styles.input,
                                getTextInputDirectionFromValue(customerSearch, isArabic),
                            ]}
                            editable={!isCreating}
                            autoCorrect={false}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                        />

                        {!cleanCustomerSearch ? (
                            <Text
                                style={[
                                    styles.emptyText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.searchHint}
                            </Text>
                        ) : !isValidCustomerSearch ? (
                            <Text
                                style={[
                                    styles.emptyText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.searchHint}
                            </Text>
                        ) : isSearchingCustomers ? (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingText}>{text.searchingCustomers}</Text>
                            </View>
                        ) : customerMembers.length > 0 ? (
                            customerMembers.map(renderMemberRow)
                        ) : (
                            <Text
                                style={[
                                    styles.emptyText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {text.noCustomers}
                            </Text>
                        )}

                        {!!errorMessage && (
                            <View style={[styles.errorBox, getRowDirectionStyle(isArabic)]}>
                                <Feather name="alert-circle" size={17} color={colors.danger} />
                                <Text
                                    style={[
                                        styles.errorText,
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    {errorMessage}
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={[styles.footer, getRowDirectionStyle(isArabic)]}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            activeOpacity={0.85}
                            onPress={handleClose}
                            disabled={isCreating}
                        >
                            <Text style={styles.cancelButtonText}>{text.cancel}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.createButton,
                                isCreateDisabled && styles.createButtonDisabled,
                            ]}
                            activeOpacity={0.85}
                            onPress={handleCreateGroup}
                            disabled={isCreateDisabled}
                        >
                            {isCreating ? (
                                <ActivityIndicator size="small" color={colors.darkText || colors.background} />
                            ) : (
                                <Feather
                                    name="users"
                                    size={17}
                                    color={colors.darkText || colors.background}
                                />
                            )}

                            <Text style={styles.createButtonText} numberOfLines={1}>
                                {isCreating ? text.creating : text.create}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: "flex-end",
            paddingHorizontal: 14,
        },

        card: {
            width: "100%",
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.cardStrong || colors.card,
            overflow: "hidden",
        },

        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft || colors.border,
            gap: 12,
        },

        headerTextWrapper: {
            flex: 1,
            minWidth: 0,
        },

        title: {
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: "900",
        },

        subtitle: {
            marginTop: 4,
            color: colors.textSecondary || colors.textMuted,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "700",
        },

        closeButton: {
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: colors.buttonSoft || colors.cardSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        body: {
            flexShrink: 1,
        },

        bodyContent: {
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 18,
        },

        label: {
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "900",
            marginBottom: 8,
        },

        input: {
            minHeight: 50,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.inputBorder || colors.border,
            backgroundColor: colors.inputBackground || colors.input || colors.card,
            color: colors.textPrimary,
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === "ios" ? 13 : 9,
            fontSize: 15,
            fontWeight: "700",
            marginBottom: 14,
        },

        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
        },

        sectionTitle: {
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "900",
            marginBottom: 10,
        },

        counterText: {
            minWidth: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.primary,
            color: colors.darkText || colors.background,
            textAlign: "center",
            textAlignVertical: "center",
            lineHeight: 26,
            fontSize: 12,
            fontWeight: "900",
            overflow: "hidden",
        },

        selectedChips: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
        },

        selectedChip: {
            maxWidth: "100%",
            minHeight: 34,
            borderRadius: 17,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.cardSoft || colors.buttonSoft,
            borderWidth: 1,
            borderColor: colors.border,
        },

        selectedChipText: {
            maxWidth: 190,
            color: colors.textPrimary,
            fontSize: 12,
            fontWeight: "900",
        },

        divider: {
            height: 1,
            backgroundColor: colors.borderSoft || colors.border,
            marginVertical: 16,
        },

        memberRow: {
            minHeight: 62,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.borderSoft || colors.border,
            backgroundColor: colors.card || colors.cardStrong,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 9,
            gap: 10,
            marginBottom: 9,
        },

        memberRowSelected: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft || colors.cardSoft,
        },

        memberAvatar: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.avatarBackground || colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.avatarBorder || colors.border,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        memberAvatarText: {
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "900",
        },

        memberInfo: {
            flex: 1,
            minWidth: 0,
        },

        memberName: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "900",
        },

        memberSubtitle: {
            marginTop: 3,
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: "700",
        },

        checkCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        checkCircleSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },

        loadingRow: {
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
        },

        loadingText: {
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: "800",
        },

        emptyText: {
            color: colors.textMuted,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "700",
            marginBottom: 8,
        },

        errorBox: {
            marginTop: 12,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.cardSoft || colors.buttonSoft,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
        },

        errorText: {
            flex: 1,
            minWidth: 0,
            color: colors.danger,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "800",
        },

        footer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: Platform.OS === "ios" ? 20 : 16,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft || colors.border,
        },

        cancelButton: {
            flex: 1,
            minHeight: 48,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.cardSoft || colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
        },

        cancelButtonText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "900",
        },

        createButton: {
            flex: 1.45,
            minHeight: 48,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
        },

        createButtonDisabled: {
            opacity: 0.55,
        },

        createButtonText: {
            color: colors.darkText || colors.background,
            fontSize: 14,
            fontWeight: "900",
        },
    });
