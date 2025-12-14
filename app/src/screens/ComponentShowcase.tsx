/**
 * 组件演示页面
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  Button,
  Input,
  Card,
  Badge,
  Avatar,
  Select,
  Modal,
  Switch,
  EmptyState,
  Slider,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AutocompleteInput,
  DatePicker,
  Stepper,
  ConfirmDialog,
  SimpleTabs,
  SimpleTabsList,
  SimpleTabsTrigger,
  SimpleTabsContent,
  SimpleSelect,
  IconText,
  WordCounter,
  TextInputBox,
  VoiceBall,
  AssistantList,
  ProgressBar,
  StatCard,
  PageHeader,
  PageContainer,
  Grid,
  GridItem,
} from '../components';
import {
  Icon,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  DollarSign,
  TrendingUp,
  BarChart,
  Mic,
  Phone,
  Settings,
  Search,
  Calendar,
} from '../components/Icons';

export default function ComponentShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [switchValue, setSwitchValue] = useState(false);
  const [sliderValue, setSliderValue] = useState([50]);
  const [tabValue, setTabValue] = useState('tab1');
  const [autocompleteValue, setAutocompleteValue] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [textMode, setTextMode] = useState<'voice' | 'text'>('voice');
  const [simpleTabValue, setSimpleTabValue] = useState('tab1');
  const [simpleSelectValue, setSimpleSelectValue] = useState('');
  const [wordCounterContent, setWordCounterContent] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState(1);

  const selectOptions = [
    { label: '选项 1', value: 'option1' },
    { label: '选项 2', value: 'option2' },
    { label: '选项 3', value: 'option3' },
  ];

  const autocompleteOptions = [
    { value: 'apple', label: '苹果', description: '一种水果' },
    { value: 'banana', label: '香蕉', description: '黄色的水果' },
    { value: 'orange', label: '橙子', description: '橙色的水果' },
    { value: 'grape', label: '葡萄', description: '紫色的小水果' },
  ];

  const stepperSteps = [
    { title: '步骤 1', description: '开始' },
    { title: '步骤 2', description: '进行中' },
    { title: '步骤 3', description: '完成' },
  ];

  const simpleSelectOptions = [
    { label: '选项 A', value: 'a' },
    { label: '选项 B', value: 'b' },
    { label: '选项 C', value: 'c' },
  ];

  const assistants = [
    { id: 1, name: '助手 1', description: '这是第一个助手', icon: '🤖' },
    { id: 2, name: '助手 2', description: '这是第二个助手', icon: '👤' },
    { id: 3, name: '助手 3', description: '这是第三个助手', icon: '💬' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>组件演示</Text>
          <Text style={styles.subtitle}>React Native UI 组件库</Text>
        </View>

        {/* Button 组件 */}
        <Card title="Button 按钮" padding="md" style={styles.section}>
          <View style={styles.buttonGroup}>
            <Button variant="primary" size="md" onPress={() => {}}>
              主要按钮
            </Button>
            <Button variant="secondary" size="md" onPress={() => {}}>
              次要按钮
            </Button>
            <Button variant="outline" size="md" onPress={() => {}}>
              轮廓按钮
            </Button>
            <Button variant="ghost" size="md" onPress={() => {}}>
              幽灵按钮
            </Button>
            <Button variant="destructive" size="md" onPress={() => {}}>
              危险按钮
            </Button>
            <Button variant="success" size="md" onPress={() => {}}>
              成功按钮
            </Button>
            <Button variant="warning" size="md" onPress={() => {}}>
              警告按钮
            </Button>
            <Button loading size="md" onPress={() => {}}>
              加载中
            </Button>
            <Button disabled size="md" onPress={() => {}}>
              禁用按钮
            </Button>
          </View>
        </Card>

        {/* Input 组件 */}
        <Card title="Input 输入框" padding="md" style={styles.section}>
          <Input
            label="普通输入框"
            placeholder="请输入内容"
            value={inputValue}
            onChangeText={setInputValue}
            style={styles.input}
          />
          <Input
            label="带错误提示"
            placeholder="请输入邮箱"
            error="请输入有效的邮箱地址"
            value={inputValue}
            onChangeText={setInputValue}
            style={styles.input}
          />
          <Input
            label="带帮助文本"
            placeholder="请输入密码"
            helperText="密码长度至少8位"
            secureTextEntry
            style={styles.input}
          />
          <Input
            label="显示字符计数"
            placeholder="请输入内容"
            showCount
            countMax={100}
            maxLength={100}
            style={styles.input}
          />
        </Card>

        {/* AutocompleteInput 组件 */}
        <Card title="AutocompleteInput 自动完成" padding="md" style={styles.section}>
          <AutocompleteInput
            label="搜索水果"
            value={autocompleteValue}
            onChange={setAutocompleteValue}
            placeholder="输入或选择水果..."
            options={autocompleteOptions}
            style={styles.input}
          />
        </Card>

        {/* Slider 组件 */}
        <Card title="Slider 滑块" padding="md" style={styles.section}>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>当前值: {sliderValue[0]}</Text>
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              min={0}
              max={100}
              step={1}
              style={styles.slider}
            />
          </View>
        </Card>

        {/* Tabs 组件 */}
        <Card title="Tabs 标签页" padding="md" style={styles.section}>
          <Tabs value={tabValue} onValueChange={setTabValue}>
            <TabsList>
              <TabsTrigger value="tab1">标签 1</TabsTrigger>
              <TabsTrigger value="tab2">标签 2</TabsTrigger>
              <TabsTrigger value="tab3">标签 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <Text style={styles.tabContent}>这是标签 1 的内容</Text>
            </TabsContent>
            <TabsContent value="tab2">
              <Text style={styles.tabContent}>这是标签 2 的内容</Text>
            </TabsContent>
            <TabsContent value="tab3">
              <Text style={styles.tabContent}>这是标签 3 的内容</Text>
            </TabsContent>
          </Tabs>
        </Card>

        {/* DatePicker 组件 */}
        <Card title="DatePicker 日期选择器" padding="md" style={styles.section}>
          <DatePicker
            label="选择日期"
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="请选择日期"
            style={styles.input}
          />
        </Card>

        {/* Stepper 组件 */}
        <Card title="Stepper 步骤条" padding="md" style={styles.section}>
          <Stepper
            steps={stepperSteps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
            orientation="horizontal"
          />
          <View style={styles.stepperControls}>
            <Button
              variant="outline"
              onPress={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              上一步
            </Button>
            <Button
              variant="primary"
              onPress={() =>
                setCurrentStep(Math.min(stepperSteps.length - 1, currentStep + 1))
              }
              disabled={currentStep === stepperSteps.length - 1}
            >
              下一步
            </Button>
          </View>
        </Card>

        {/* Card 组件 */}
        <Card title="Card 卡片" padding="md" style={styles.section}>
          <Card variant="outlined" padding="sm" style={styles.cardExample}>
            <Text>轮廓卡片</Text>
          </Card>
          <Card variant="elevated" padding="sm" style={styles.cardExample}>
            <Text>阴影卡片</Text>
          </Card>
          <Card variant="filled" padding="sm" style={styles.cardExample}>
            <Text>填充卡片</Text>
          </Card>
        </Card>

        {/* Badge 组件 */}
        <Card title="Badge 徽章" padding="md" style={styles.section}>
          <View style={styles.badgeGroup}>
            <Badge variant="default">默认</Badge>
            <Badge variant="primary">主要</Badge>
            <Badge variant="secondary">次要</Badge>
            <Badge variant="success">成功</Badge>
            <Badge variant="warning">警告</Badge>
            <Badge variant="error">错误</Badge>
            <Badge variant="outline">轮廓</Badge>
            <Badge variant="muted">静音</Badge>
          </View>
        </Card>

        {/* Avatar 组件 */}
        <Card title="Avatar 头像" padding="md" style={styles.section}>
          <View style={styles.avatarGroup}>
            <Avatar fallback="A" size="sm" />
            <Avatar fallback="B" size="md" />
            <Avatar fallback="C" size="lg" />
            <Avatar fallback="D" size="xl" />
          </View>
        </Card>

        {/* Select 组件 */}
        <Card title="Select 选择器" padding="md" style={styles.section}>
          <Select
            value={selectValue}
            onValueChange={setSelectValue}
            options={selectOptions}
            placeholder="请选择选项"
            style={styles.select}
          />
        </Card>

        {/* Switch 组件 */}
        <Card title="Switch 开关" padding="md" style={styles.section}>
          <View style={styles.switchGroup}>
            <View style={styles.switchItem}>
              <Text>通知开关</Text>
              <Switch
                checked={switchValue}
                onCheckedChange={setSwitchValue}
              />
            </View>
            <View style={styles.switchItem}>
              <Text>禁用状态</Text>
              <Switch checked={false} disabled onCheckedChange={() => {}} />
            </View>
          </View>
        </Card>

        {/* Modal 组件 */}
        <Card title="Modal 模态框" padding="md" style={styles.section}>
          <Button
            variant="primary"
            onPress={() => setModalVisible(true)}
          >
            打开模态框
          </Button>
          <Modal
            isOpen={modalVisible}
            onClose={() => setModalVisible(false)}
            title="示例模态框"
          >
            <Text>这是一个模态框示例</Text>
            <Text style={styles.modalText}>
              你可以在这里放置任何内容
            </Text>
            <Button
              variant="primary"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              关闭
            </Button>
          </Modal>
        </Card>

        {/* ConfirmDialog 组件 */}
        <Card title="ConfirmDialog 确认对话框" padding="md" style={styles.section}>
          <View style={styles.buttonGroup}>
            <Button
              variant="primary"
              onPress={() => setConfirmDialogVisible(true)}
            >
              打开确认对话框
            </Button>
            <Button
              variant="destructive"
              onPress={() => setConfirmDialogVisible(true)}
            >
              危险操作
            </Button>
          </View>
          <ConfirmDialog
            isOpen={confirmDialogVisible}
            onClose={() => setConfirmDialogVisible(false)}
            onConfirm={() => {
              console.log('确认操作');
            }}
            title="确认操作"
            description="你确定要执行这个操作吗？"
            confirmText="确认"
            cancelText="取消"
            variant="default"
          />
        </Card>

        {/* TextInputBox 组件 */}
        <Card title="TextInputBox 文本输入框" padding="md" style={styles.section}>
          <TextInputBox
            inputValue={textInputValue}
            onInputChange={setTextInputValue}
            isWaitingForResponse={false}
            onSend={() => {
              console.log('发送:', textInputValue);
            }}
            textMode={textMode}
            onTextModeChange={setTextMode}
          />
        </Card>

        {/* VoiceBall 组件 */}
        <Card title="VoiceBall 语音球" padding="md" style={styles.section}>
          <VoiceBall
            isCalling={isCalling}
            onToggleCall={() => setIsCalling(!isCalling)}
          />
        </Card>

        {/* SimpleTabs 组件 */}
        <Card title="SimpleTabs 简单标签页" padding="md" style={styles.section}>
          <SimpleTabs value={simpleTabValue} onValueChange={setSimpleTabValue}>
            <SimpleTabsList>
              <SimpleTabsTrigger value="tab1">标签 1</SimpleTabsTrigger>
              <SimpleTabsTrigger value="tab2">标签 2</SimpleTabsTrigger>
              <SimpleTabsTrigger value="tab3">标签 3</SimpleTabsTrigger>
            </SimpleTabsList>
            <SimpleTabsContent value="tab1">
              <Text style={styles.tabContent}>简单标签页 1 的内容</Text>
            </SimpleTabsContent>
            <SimpleTabsContent value="tab2">
              <Text style={styles.tabContent}>简单标签页 2 的内容</Text>
            </SimpleTabsContent>
            <SimpleTabsContent value="tab3">
              <Text style={styles.tabContent}>简单标签页 3 的内容</Text>
            </SimpleTabsContent>
          </SimpleTabs>
        </Card>

        {/* SimpleSelect 组件 */}
        <Card title="SimpleSelect 简单选择器" padding="md" style={styles.section}>
          <SimpleSelect
            value={simpleSelectValue}
            onValueChange={setSimpleSelectValue}
            options={simpleSelectOptions}
            placeholder="请选择..."
            style={styles.select}
          />
        </Card>

        {/* IconText 组件 */}
        <Card title="IconText 图标文本" padding="md" style={styles.section}>
          <View style={styles.iconTextGroup}>
            <IconText
              icon={<Smartphone size={20} color="#3b82f6" />}
              size="md"
              variant="primary"
            >
              主要图标
            </IconText>
            <IconText
              icon={<CheckCircle size={20} color="#10b981" />}
              size="md"
              variant="success"
            >
              成功图标
            </IconText>
            <IconText
              icon={<AlertTriangle size={20} color="#f59e0b" />}
              size="md"
              variant="warning"
            >
              警告图标
            </IconText>
            <IconText
              icon={<XCircle size={20} color="#ef4444" />}
              size="md"
              variant="error"
            >
              错误图标
            </IconText>
            <IconText
              icon={<Icon name="heart" library="Feather" size={20} color="#ec4899" />}
              size="md"
              variant="default"
            >
              自定义图标
            </IconText>
          </View>
        </Card>

        {/* 图标库展示 */}
        <Card title="图标库示例" padding="md" style={styles.section}>
          <Text style={styles.iconSectionTitle}>常用图标：</Text>
          <View style={styles.iconShowcase}>
            <View style={styles.iconItem}>
              <Mic size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Mic</Text>
            </View>
            <View style={styles.iconItem}>
              <Phone size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Phone</Text>
            </View>
            <View style={styles.iconItem}>
              <Users size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Users</Text>
            </View>
            <View style={styles.iconItem}>
              <Settings size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Settings</Text>
            </View>
            <View style={styles.iconItem}>
              <Search size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Search</Text>
            </View>
            <View style={styles.iconItem}>
              <CheckCircle size={24} color="#10b981" />
              <Text style={styles.iconLabel}>CheckCircle</Text>
            </View>
            <View style={styles.iconItem}>
              <AlertTriangle size={24} color="#f59e0b" />
              <Text style={styles.iconLabel}>AlertTriangle</Text>
            </View>
            <View style={styles.iconItem}>
              <Calendar size={24} color="#3b82f6" />
              <Text style={styles.iconLabel}>Calendar</Text>
            </View>
          </View>
          <Text style={styles.iconSectionNote}>
            使用 @expo/vector-icons 图标库，支持多种图标集：
            MaterialIcons, Feather, Ionicons, FontAwesome 等
          </Text>
        </Card>

        {/* ProgressBar 组件 */}
        <Card title="ProgressBar 进度条" padding="md" style={styles.section}>
          <ProgressBar
            value={75}
            max={100}
            variant="default"
            showValue
            label="默认进度"
            style={styles.progressBar}
          />
          <ProgressBar
            value={60}
            max={100}
            variant="success"
            showValue
            label="成功进度"
            style={styles.progressBar}
          />
          <ProgressBar
            value={40}
            max={100}
            variant="warning"
            showValue
            label="警告进度"
            style={styles.progressBar}
          />
          <ProgressBar
            value={20}
            max={100}
            variant="error"
            showValue
            label="错误进度"
            style={styles.progressBar}
          />
        </Card>

        {/* StatCard 组件 */}
        <Card title="StatCard 统计卡片" padding="md" style={styles.section}>
          <View style={styles.statCardGroup}>
            <StatCard
              title="总用户数"
              value="1,234"
              change={{ value: 12, type: 'increase' }}
              icon={<Users size={24} color="#3b82f6" />}
            />
            <StatCard
              title="总收入"
              value="¥56,789"
              change={{ value: 8, type: 'increase' }}
              icon={<DollarSign size={24} color="#10b981" />}
            />
            <StatCard
              title="活跃度"
              value="89%"
              change={{ value: 5, type: 'decrease' }}
              icon={<BarChart size={24} color="#f59e0b" />}
            />
          </View>
        </Card>

        {/* WordCounter 组件 */}
        <Card title="WordCounter 字数统计" padding="md" style={styles.section}>
          <Input
            label="输入内容"
            placeholder="输入一些文字..."
            value={wordCounterContent}
            onChangeText={setWordCounterContent}
            multiline
            numberOfLines={4}
            style={styles.input}
          />
          <WordCounter
            content={wordCounterContent}
            targetWords={100}
            showStats
            showProgress
            style={styles.wordCounter}
          />
        </Card>

        {/* AssistantList 组件 */}
        <Card title="AssistantList 助手列表" padding="md" style={styles.section}>
          <View style={styles.assistantListContainer}>
            {assistants.map((assistant) => (
              <TouchableOpacity
                key={assistant.id}
                onPress={() => setSelectedAssistant(assistant.id)}
                style={[
                  styles.assistantItem,
                  selectedAssistant === assistant.id && styles.assistantItemSelected,
                ]}
              >
                <View style={styles.assistantContent}>
                  <View style={styles.assistantIcon}>
                    <Text style={styles.assistantIconText}>{assistant.icon}</Text>
                  </View>
                  <View style={styles.assistantInfo}>
                    <Text style={styles.assistantName}>{assistant.name}</Text>
                    <Text style={styles.assistantDesc}>{assistant.description}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* PageHeader 组件 */}
        <Card title="PageHeader 页面标题" padding="md" style={styles.section}>
          <PageHeader
            title="页面标题"
            subtitle="这是页面副标题"
            breadcrumbs={[
              { label: '首页', onPress: () => {} },
              { label: '当前页面' },
            ]}
          />
        </Card>

        {/* Grid 组件 */}
        <Card title="Grid 网格布局" padding="md" style={styles.section}>
          <Grid cols={3} gap="md">
            <GridItem span={1}>
              <View style={styles.gridItem}>
                <Text>项目 1</Text>
              </View>
            </GridItem>
            <GridItem span={1}>
              <View style={styles.gridItem}>
                <Text>项目 2</Text>
              </View>
            </GridItem>
            <GridItem span={1}>
              <View style={styles.gridItem}>
                <Text>项目 3</Text>
              </View>
            </GridItem>
          </Grid>
        </Card>

        {/* EmptyState 组件 */}
        <Card title="EmptyState 空状态" padding="md" style={styles.section}>
          <EmptyState
            icon={<Icon name="inbox" library="Feather" size={48} color="#9ca3af" />}
            title="暂无数据"
            description="这里还没有任何内容"
            action={{
              label: '创建新内容',
              onPress: () => {},
            }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  input: {
    marginBottom: 16,
  },
  cardExample: {
    marginBottom: 12,
  },
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  select: {
    marginBottom: 16,
  },
  switchGroup: {
    gap: 16,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalText: {
    marginTop: 12,
    marginBottom: 20,
    color: '#666',
  },
  modalButton: {
    marginTop: 12,
  },
  sliderContainer: {
    gap: 12,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  slider: {
    marginBottom: 8,
  },
  tabContent: {
    padding: 16,
    fontSize: 14,
    color: '#374151',
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  iconTextGroup: {
    gap: 16,
  },
  progressBar: {
    marginBottom: 16,
  },
  statCardGroup: {
    gap: 12,
  },
  statIcon: {
    fontSize: 24,
  },
  wordCounter: {
    marginTop: 16,
  },
  assistantListContainer: {
    gap: 8,
  },
  assistantItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  assistantItemSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#faf5ff',
  },
  assistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assistantIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantIconText: {
    fontSize: 24,
  },
  assistantInfo: {
    flex: 1,
  },
  assistantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  assistantDesc: {
    fontSize: 14,
    color: '#6b7280',
  },
  gridItem: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  iconSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  iconShowcase: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  iconItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  iconLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  iconSectionNote: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
