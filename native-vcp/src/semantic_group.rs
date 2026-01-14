//! SemanticGroupMatcher - 语义组匹配器
//!
//! 从 VCP rust-vexus-lite 移植的语义组匹配实现。
//! 用于快速识别查询中的语义关键词并进行分组。
//!
//! 使用场景:
//! - 服装分类 (颜色、图案、款式、材质等)
//! - 商品属性提取
//! - 查询意图识别

#![allow(clippy::new_without_default)]

use hashbrown::{HashMap, HashSet};
use napi_derive::napi;

// ==================== 类型定义 ====================

/// 语义组类型枚举
#[napi(string_enum)]
#[derive(Debug, PartialEq, Eq, Hash)]
pub enum SemanticGroupType {
    /// 颜色
    Color,
    /// 图案/花纹
    Pattern,
    /// 廓形/版型
    Silhouette,
    /// 风格
    Style,
    /// 材质
    Material,
    /// 场合
    Occasion,
    /// 季节
    Season,
    /// 自定义
    Custom,
}

/// 语义组匹配结果
#[napi(object)]
pub struct SemanticGroupMatch {
    /// 组类型
    pub group_type: String,
    /// 子组名称
    pub sub_group: String,
    /// 匹配到的关键词
    pub matched_keywords: Vec<String>,
    /// 匹配权重 (0-1)
    pub weight: f64,
}

/// 语义组关键词定义
#[napi(object)]
pub struct GroupKeywords {
    /// 组类型
    pub group_type: String,
    /// 子组名称
    pub sub_group: String,
    /// 关键词列表
    pub keywords: Vec<String>,
}

// ==================== SemanticGroupMatcher ====================

/// 语义组匹配器
///
/// 用于快速查找文本中的语义关键词并进行分组。
/// 支持多语言关键词和同义词扩展。
#[napi]
pub struct SemanticGroupMatcher {
    /// 关键词到 (group_type, sub_group) 的映射
    keyword_index: HashMap<String, (String, String)>,
    /// 组 -> 子组 -> 关键词列表
    group_data: HashMap<String, HashMap<String, Vec<String>>>,
}

#[napi]
impl SemanticGroupMatcher {
    /// 创建空的匹配器
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            keyword_index: HashMap::new(),
            group_data: HashMap::new(),
        }
    }

    /// 创建带有默认服装语义组的匹配器
    #[napi(factory)]
    pub fn with_fashion_groups() -> Self {
        let mut matcher = Self::new();

        // 颜色组
        matcher.register_group(
            "color".to_string(),
            "neutral".to_string(),
            vec![
                "黑色".to_string(),
                "白色".to_string(),
                "灰色".to_string(),
                "black".to_string(),
                "white".to_string(),
                "gray".to_string(),
                "grey".to_string(),
            ],
        );
        matcher.register_group(
            "color".to_string(),
            "warm".to_string(),
            vec![
                "红色".to_string(),
                "橙色".to_string(),
                "黄色".to_string(),
                "粉色".to_string(),
                "red".to_string(),
                "orange".to_string(),
                "yellow".to_string(),
                "pink".to_string(),
            ],
        );
        matcher.register_group(
            "color".to_string(),
            "cool".to_string(),
            vec![
                "蓝色".to_string(),
                "绿色".to_string(),
                "紫色".to_string(),
                "青色".to_string(),
                "blue".to_string(),
                "green".to_string(),
                "purple".to_string(),
                "cyan".to_string(),
            ],
        );

        // 图案组
        matcher.register_group(
            "pattern".to_string(),
            "stripe".to_string(),
            vec![
                "条纹".to_string(),
                "横条".to_string(),
                "竖条".to_string(),
                "stripe".to_string(),
                "striped".to_string(),
            ],
        );
        matcher.register_group(
            "pattern".to_string(),
            "check".to_string(),
            vec![
                "格子".to_string(),
                "格纹".to_string(),
                "方格".to_string(),
                "check".to_string(),
                "plaid".to_string(),
                "checkered".to_string(),
            ],
        );
        matcher.register_group(
            "pattern".to_string(),
            "floral".to_string(),
            vec![
                "花卉".to_string(),
                "碎花".to_string(),
                "印花".to_string(),
                "floral".to_string(),
                "flower".to_string(),
                "print".to_string(),
            ],
        );
        matcher.register_group(
            "pattern".to_string(),
            "solid".to_string(),
            vec![
                "纯色".to_string(),
                "素色".to_string(),
                "solid".to_string(),
                "plain".to_string(),
            ],
        );

        // 风格组
        matcher.register_group(
            "style".to_string(),
            "casual".to_string(),
            vec![
                "休闲".to_string(),
                "日常".to_string(),
                "casual".to_string(),
                "everyday".to_string(),
            ],
        );
        matcher.register_group(
            "style".to_string(),
            "formal".to_string(),
            vec![
                "正式".to_string(),
                "商务".to_string(),
                "职业".to_string(),
                "formal".to_string(),
                "business".to_string(),
                "office".to_string(),
            ],
        );
        matcher.register_group(
            "style".to_string(),
            "sporty".to_string(),
            vec![
                "运动".to_string(),
                "健身".to_string(),
                "sporty".to_string(),
                "athletic".to_string(),
                "sport".to_string(),
            ],
        );

        // 材质组
        matcher.register_group(
            "material".to_string(),
            "cotton".to_string(),
            vec![
                "棉".to_string(),
                "纯棉".to_string(),
                "全棉".to_string(),
                "cotton".to_string(),
            ],
        );
        matcher.register_group(
            "material".to_string(),
            "silk".to_string(),
            vec![
                "丝".to_string(),
                "真丝".to_string(),
                "丝绸".to_string(),
                "silk".to_string(),
                "satin".to_string(),
            ],
        );
        matcher.register_group(
            "material".to_string(),
            "wool".to_string(),
            vec![
                "羊毛".to_string(),
                "毛呢".to_string(),
                "羊绒".to_string(),
                "wool".to_string(),
                "cashmere".to_string(),
            ],
        );
        matcher.register_group(
            "material".to_string(),
            "denim".to_string(),
            vec![
                "牛仔".to_string(),
                "丹宁".to_string(),
                "denim".to_string(),
                "jeans".to_string(),
            ],
        );

        // 季节组
        matcher.register_group(
            "season".to_string(),
            "spring_summer".to_string(),
            vec![
                "春夏".to_string(),
                "夏季".to_string(),
                "春季".to_string(),
                "summer".to_string(),
                "spring".to_string(),
            ],
        );
        matcher.register_group(
            "season".to_string(),
            "fall_winter".to_string(),
            vec![
                "秋冬".to_string(),
                "冬季".to_string(),
                "秋季".to_string(),
                "winter".to_string(),
                "fall".to_string(),
                "autumn".to_string(),
            ],
        );

        tracing::info!(
            keywords = matcher.keyword_index.len(),
            groups = matcher.group_data.len(),
            "SemanticGroupMatcher initialized with fashion groups"
        );

        matcher
    }

    /// 注册一个语义组
    ///
    /// @param group_type - 组类型（如 "color", "pattern"）
    /// @param sub_group - 子组名称（如 "warm", "cool"）
    /// @param keywords - 关键词列表
    #[napi]
    pub fn register_group(
        &mut self,
        group_type: String,
        sub_group: String,
        keywords: Vec<String>,
    ) {
        // 更新组数据
        self.group_data
            .entry(group_type.clone())
            .or_default()
            .insert(sub_group.clone(), keywords.clone());

        // 更新关键词索引
        for keyword in keywords {
            let normalized = keyword.to_lowercase();
            self.keyword_index
                .insert(normalized, (group_type.clone(), sub_group.clone()));
        }
    }

    /// 批量注册语义组
    #[napi]
    pub fn register_groups(&mut self, groups: Vec<GroupKeywords>) {
        for g in groups {
            self.register_group(g.group_type, g.sub_group, g.keywords);
        }
    }

    /// 从文本中提取匹配的语义组
    ///
    /// @param text - 要匹配的文本
    /// @returns 匹配到的语义组列表
    #[napi]
    pub fn extract_matches(&self, text: String) -> Vec<SemanticGroupMatch> {
        let normalized_text = text.to_lowercase();
        let mut matches_by_type: HashMap<String, SemanticGroupMatch> = HashMap::new();

        for (keyword, (group_type, sub_group)) in &self.keyword_index {
            if normalized_text.contains(keyword) {
                let existing = matches_by_type.get_mut(group_type);

                if let Some(m) = existing {
                    // 合并到已有匹配
                    if !m.matched_keywords.contains(keyword) {
                        m.matched_keywords.push(keyword.clone());
                        m.weight = (m.weight + 0.2).min(1.0);
                    }
                } else {
                    // 创建新匹配
                    matches_by_type.insert(
                        group_type.clone(),
                        SemanticGroupMatch {
                            group_type: group_type.clone(),
                            sub_group: sub_group.clone(),
                            matched_keywords: vec![keyword.clone()],
                            weight: 0.5,
                        },
                    );
                }
            }
        }

        matches_by_type.into_values().collect()
    }

    /// 获取同组的扩展关键词
    ///
    /// 根据匹配结果，返回同一子组内未匹配的其他关键词。
    /// 用于查询扩展。
    #[napi]
    pub fn expand_keywords(&self, matches: Vec<SemanticGroupMatch>) -> Vec<String> {
        let mut expanded: HashSet<String> = HashSet::new();

        for m in &matches {
            if let Some(sub_groups) = self.group_data.get(&m.group_type) {
                if let Some(keywords) = sub_groups.get(&m.sub_group) {
                    for kw in keywords {
                        let normalized = kw.to_lowercase();
                        if !m.matched_keywords.contains(&normalized) {
                            expanded.insert(kw.clone());
                        }
                    }
                }
            }
        }

        expanded.into_iter().collect()
    }

    /// 计算两组匹配的重叠分数
    ///
    /// 用于比较查询和结果的语义相似度。
    ///
    /// @param query_matches - 查询的匹配结果
    /// @param result_matches - 结果的匹配结果
    /// @returns 重叠分数 (0-1)
    #[napi]
    pub fn calculate_overlap(
        &self,
        query_matches: Vec<SemanticGroupMatch>,
        result_matches: Vec<SemanticGroupMatch>,
    ) -> f64 {
        if query_matches.is_empty() {
            return 0.0;
        }

        let mut total_score = 0.0;

        for q_match in &query_matches {
            // 查找结果中相同类型的匹配
            let r_match = result_matches
                .iter()
                .find(|r| r.group_type == q_match.group_type);

            if let Some(r) = r_match {
                // 检查关键词重叠
                let overlap_count = q_match
                    .matched_keywords
                    .iter()
                    .filter(|k| r.matched_keywords.contains(k))
                    .count();

                let weight = if overlap_count > 0 {
                    1.0
                } else if r.sub_group == q_match.sub_group {
                    0.7 // 同子组也有一定权重
                } else {
                    0.0
                };

                total_score += q_match.weight * weight;
            }
        }

        total_score / query_matches.len() as f64
    }

    /// 获取某组的所有关键词
    ///
    /// @param group_type - 组类型
    /// @param sub_group - 子组名称（可选，不指定则返回所有子组的关键词）
    #[napi]
    pub fn get_group_keywords(&self, group_type: String, sub_group: Option<String>) -> Vec<String> {
        if let Some(sub_groups) = self.group_data.get(&group_type) {
            if let Some(sg) = sub_group {
                return sub_groups.get(&sg).cloned().unwrap_or_default();
            } else {
                // 返回该类型所有关键词
                return sub_groups.values().flatten().cloned().collect();
            }
        }
        Vec::new()
    }

    /// 获取已注册的关键词数量
    #[napi]
    pub fn keyword_count(&self) -> u32 {
        self.keyword_index.len() as u32
    }

    /// 获取所有组类型
    #[napi]
    pub fn get_group_types(&self) -> Vec<String> {
        self.group_data.keys().cloned().collect()
    }

    /// 获取某个组类型的所有子组
    #[napi]
    pub fn get_sub_groups(&self, group_type: String) -> Vec<String> {
        self.group_data
            .get(&group_type)
            .map(|sg| sg.keys().cloned().collect())
            .unwrap_or_default()
    }

    /// 检查关键词是否存在
    #[napi]
    pub fn has_keyword(&self, keyword: String) -> bool {
        self.keyword_index.contains_key(&keyword.to_lowercase())
    }

    /// 获取关键词所属的组信息
    #[napi]
    pub fn get_keyword_group(&self, keyword: String) -> Option<GroupKeywords> {
        self.keyword_index
            .get(&keyword.to_lowercase())
            .map(|(group_type, sub_group)| GroupKeywords {
                group_type: group_type.clone(),
                sub_group: sub_group.clone(),
                keywords: vec![keyword],
            })
    }
}
